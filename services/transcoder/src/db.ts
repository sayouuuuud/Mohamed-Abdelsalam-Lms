'use strict'
/**
 * db.ts
 * طبقة الاتصال بـ Supabase من داخل الوركر.
 * بيستخدم SUPABASE_URL + SUPABASE_SERVICE_KEY (service_role) مباشرة —
 * لا يمر عبر RLS — ده مقصود عشان الوركر يكون خارج دائرة الـ auth.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getDb(): SupabaseClient {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('[transcoder] SUPABASE_URL أو SUPABASE_SERVICE_KEY غير موجودين في .env')
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
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
  const db = getDb()
  const { data, error } = await db.rpc('claim_next_video_job')
  if (error) {
    console.error('[transcoder] claimNextJob error:', error.message)
    return null
  }
  if (!data || data.length === 0) return null
  const row = data[0]
  return {
    jobId:          row.job_id,
    videoId:        row.video_id,
    r2RawKey:       row.r2_raw_key,
    threadsOverride: row.threads_override ?? null,
  }
}

// تحديث حالة الـ job أثناء المعالجة
export async function updateJobProgress(jobId: string, progress: number): Promise<void> {
  const db = getDb()
  await db
    .from('video_jobs')
    .update({ progress: Math.round(progress), updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

// تحديث حالة الـ video و job عند الانتهاء
export async function markVideoReady(
  jobId: string,
  videoId: string,
  hlsPrefix: string,
  durationSeconds: number,
): Promise<void> {
  const db = getDb()
  const now = new Date().toISOString()

  await db
    .from('videos')
    .update({
      status:         'ready',
      r2_hls_prefix:  hlsPrefix,
      duration_sec:   durationSeconds,
      updated_at:     now,
    })
    .eq('id', videoId)

  await db
    .from('video_jobs')
    .update({ status: 'done', progress: 100, finished_at: now, updated_at: now })
    .eq('id', jobId)
}

// تسجيل فشل
export async function markVideoFailed(
  jobId: string,
  videoId: string,
  errorMsg: string,
): Promise<void> {
  const db = getDb()
  const now = new Date().toISOString()

  await db
    .from('videos')
    .update({ status: 'error', updated_at: now })
    .eq('id', videoId)

  await db
    .from('video_jobs')
    .update({ status: 'error', error_message: errorMsg, finished_at: now, updated_at: now })
    .eq('id', jobId)
}

// جلب إعدادات الـ streaming من الـ admin panel (threads + concurrency)
export async function getStreamingConfig(): Promise<{
  maxConcurrentJobs: number
  ffmpegThreads: number
  renditions: string[]
} | null> {
  const db = getDb()
  const { data, error } = await db
    .from('streaming_settings')
    .select('max_concurrent_jobs, ffmpeg_threads, renditions')
    .eq('id', 1)
    .single()

  if (error || !data) return null
  return {
    maxConcurrentJobs: data.max_concurrent_jobs ?? 2,
    ffmpegThreads:     data.ffmpeg_threads ?? 0,
    renditions:        data.renditions ?? ['360p', '480p', '720p'],
  }
}
