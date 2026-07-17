'use strict'
/**
 * db.ts
 * طبقة الاتصال بقاعدة بيانات PostgreSQL مباشرة من داخل الوركر.
 * بيستخدم DATABASE_URL — لا يمر عبر Prisma عشان يكون خفيف ومستقل.
 */

import os from 'os'
import pg from 'pg'
const { Pool } = pg

const WORKER_ID = process.env.WORKER_ID?.trim() || `${os.hostname()}:${process.pid}`
const MAX_ERROR_LENGTH = 8_000

let _pool: pg.Pool | null = null

export function getDbPool(): pg.Pool {
  if (_pool) return _pool
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('[transcoder] DATABASE_URL غير موجود في .env')
  }
  _pool = new Pool({
    connectionString: url,
    max: 10, // Max 10 connections for the worker
  })
  return _pool
}

// ---------------------------------------------------------------
// claim: يحجز job واحد بشكل آمن (لا race condition مع replicas متعددة)
// بيستخدم دالة claim_next_video_job() الـ SQL اللي اتعرّفت في M1
// ---------------------------------------------------------------
export async function claimNextJob(): Promise<{
  jobId: string
  videoId: string
  r2RawKey: string
  threadsOverride: number | null
} | null> {
  const pool = getDbPool()
  const { rows } = await pool.query(
    'SELECT * FROM public.claim_next_video_job($1)',
    [WORKER_ID],
  )
  if (!rows || rows.length === 0) return null
  const row = rows[0]
  return {
    jobId:           row.job_id,
    videoId:         row.video_id,
    r2RawKey:        row.r2_raw_key,
    threadsOverride: row.threads_override ?? null,
  }
}

// يجدّد lease للـ job أثناء المعالجة. الجدول الحالي لا يحتوي عمود progress.
export async function updateJobProgress(jobId: string, _progress: number): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE public.video_jobs
     SET claimed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'claimed' AND claimed_by = $2`,
    [jobId, WORKER_ID],
  )
}

// تحديث حالة الـ video و job عند الانتهاء
export async function markVideoReady(
  jobId: string,
  videoId: string,
  hlsPrefix: string,
  durationSeconds: number,
): Promise<void> {
  const pool = getDbPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    await client.query(
      `UPDATE videos 
       SET status = 'ready', r2_hls_prefix = $1, duration_sec = $2, updated_at = NOW() 
       WHERE id = $3`,
      [hlsPrefix, Math.round(durationSeconds), videoId]
    )

    await client.query(
      `UPDATE public.video_jobs
       SET status = 'done', completed_at = NOW(), claimed_by = NULL,
           claimed_at = NULL, last_error = NULL, updated_at = NOW()
       WHERE id = $1`,
      [jobId],
    )

    await client.query('COMMIT')
  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('[transcoder] markVideoReady error:', error.message)
    throw error
  } finally {
    client.release()
  }
}

// تسجيل فشل
export async function markVideoFailed(
  jobId: string,
  videoId: string,
  errorMsg: string,
): Promise<void> {
  const pool = getDbPool()
  const client = await pool.connect()
  const storedError = errorMsg.slice(0, MAX_ERROR_LENGTH)
  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE public.videos SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [storedError, videoId],
    )

    await client.query(
      `UPDATE public.video_jobs
       SET status = 'failed', last_error = $1, completed_at = NOW(),
           claimed_by = NULL, claimed_at = NULL, updated_at = NOW()
       WHERE id = $2`,
      [storedError, jobId],
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// جلب إعدادات الـ streaming من platform_settings
export async function getStreamingConfig(): Promise<{
  isStreamingEnabled: boolean
  maxConcurrentJobs: number
  ffmpegThreads: number
  renditions: any[]
  segmentDurationSec: number
} | null> {
  const pool = getDbPool()
  try {
    const { rows } = await pool.query(
      `SELECT is_streaming_enabled, worker_concurrency, worker_cpu_threads, segment_duration_sec, renditions FROM platform_settings WHERE id = 1 LIMIT 1`
    )
    if (!rows || rows.length === 0) return null
    
    const data = rows[0]
    let renditionsData = data.renditions
    if (typeof renditionsData === 'string') {
      try { renditionsData = JSON.parse(renditionsData) } catch (e) {}
    }
    
    return {
      isStreamingEnabled: data.is_streaming_enabled ?? false,
      maxConcurrentJobs: data.worker_concurrency ?? 1,
      ffmpegThreads:     data.worker_cpu_threads ?? 2,
      segmentDurationSec: data.segment_duration_sec ?? 4,
      renditions:        Array.isArray(renditionsData) && renditionsData.length > 0 ? renditionsData : [],
    }
  } catch (error: any) {
    console.error('[transcoder] getStreamingConfig error:', error.message)
    return null
  }
}
