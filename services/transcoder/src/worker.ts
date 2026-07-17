'use strict'
/**
 * worker.ts — الـ job processor الرئيسي
 *
 * يشتغل بأحد وضعين (يُحدَّد من .env):
 *   - WORKER_MODE=http   → يُفعَّل بـ HTTP POST /wake  (scale-to-zero)
 *   - WORKER_MODE=poll   → يستطلع DB كل POLL_INTERVAL_MS (always-on)
 *
 * لكل job:
 *   1. claimNextJob() — يحجز بأمان (بدون race condition)
 *   2. ينزّل الـ raw file من R2 لمجلد tmp
 *   3. يشغّل FFmpeg → HLS segments + master.m3u8
 *   4. يرفع ناتج HLS لـ R2 تحت prefix = "hls/{videoId}/"
 *   5. يحذف الملفات المؤقتة
 *   6. يُحدّث video.status = 'ready' في DB
 */

import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { claimNextJob, updateJobProgress, markVideoReady, markVideoFailed, getStreamingConfig } from './db.js'
import { downloadRaw, uploadDirectory, deleteFromR2 } from './r2.js'
import { transcode } from './ffmpeg.js'

const TMP_BASE = process.env.TMP_DIR ?? os.tmpdir()
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '10000')

// ---------------------------------------------------------------
// processOneJob: ينفّذ دورة كاملة لـ job واحد
// ---------------------------------------------------------------
export async function processOneJob(): Promise<boolean> {
  const config = await getStreamingConfig()

  const job = await claimNextJob()
  if (!job) return false   // لا يوجد شغل دلوقتي

  const { jobId, videoId, r2RawKey, threadsOverride } = job
  const threads  = threadsOverride ?? config?.ffmpegThreads ?? 0
  const renditions = config?.renditions ?? ['360p', '480p', '720p']
  const segmentDurationSec = config?.segmentDurationSec ?? 10

  // مجلد مؤقت مخصص لهذا الـ job — يُحذف في النهاية
  const workDir    = path.join(TMP_BASE, `transcoder_${jobId}`)
  const rawPath    = path.join(workDir, 'raw_input')
  const hlsOutDir  = path.join(workDir, 'hls_output')
  const r2HlsPrefix = `hls/${videoId}/`

  console.log(`[worker] بدأ الـ job ${jobId} | video: ${videoId}`)
  console.log(`[worker] renditions: ${renditions.join(', ')} | threads: ${threads || 'auto'}`)

  let heartbeatInterval: NodeJS.Timeout | null = null

  try {
    heartbeatInterval = setInterval(() => {
      updateJobProgress(jobId, 0).catch(err => console.error(`[worker] heartbeat failed for ${jobId}`, err))
    }, 15000)

    await fs.mkdir(workDir, { recursive: true })
    await fs.mkdir(hlsOutDir, { recursive: true })

    // المرحلة 1: تنزيل الملف الخام
    console.log('[worker] جاري تنزيل الملف الخام من R2 ...')
    await updateJobProgress(jobId, 5)
    await downloadRaw(r2RawKey, rawPath)
    await updateJobProgress(jobId, 15)

    // المرحلة 2: تحويل FFmpeg → HLS
    console.log('[worker] جاري تحويل الفيديو ...')
    const { durationSeconds } = await transcode({
      inputPath:  rawPath,
      outputDir:  hlsOutDir,
      renditions,
      threads,
      segmentDurationSec,
      onProgress: async (pct) => {
        // range الـ progress هنا = 15% → 80%
        await updateJobProgress(jobId, 15 + pct * 0.65)
      },
    })
    await updateJobProgress(jobId, 80)

    // المرحلة 3: رفع HLS لـ R2
    console.log('[worker] جاري رفع HLS لـ R2 ...')
    await uploadDirectory(hlsOutDir, r2HlsPrefix)
    await updateJobProgress(jobId, 95)

    // المرحلة 4: تحديث DB
    await markVideoReady(jobId, videoId, r2HlsPrefix, durationSeconds)
    console.log(`[worker] job ${jobId} اكتمل بنجاح (${Math.round(durationSeconds)}s)`)

    // المرحلة 5: حذف الملف الخام من R2 لتوفير المساحة
    await deleteFromR2(r2RawKey)

    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[worker] job ${jobId} فشل:`, err)
    try {
      await markVideoFailed(jobId, videoId, msg)
    } catch (persistenceError) {
      console.error(
        `[worker] تعذّر حفظ فشل job ${jobId}; processing error: ${msg}`,
        persistenceError,
      )
    }
    return false
  } finally {
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    // تنظيف الملفات المؤقتة دايماً
    try {
      await fs.rm(workDir, { recursive: true, force: true })
      console.log(`[worker] تنظيف ${workDir}`)
    } catch (cleanupError) {
      console.error(`[worker] تعذّر تنظيف ${workDir}:`, cleanupError)
    }
  }
}

// ---------------------------------------------------------------
// runLoop: يُشغَّل في وضع poll
// بيستطلع DB بشكل متكرر — لما مفيش شغل يستنى POLL_INTERVAL_MS
// ---------------------------------------------------------------
export async function runLoop(): Promise<never> {
  console.log(`[worker] وضع polling — كل ${POLL_INTERVAL_MS}ms`)
  while (true) {
    try {
      const didWork = await processOneJob()
      if (!didWork) {
        await sleep(POLL_INTERVAL_MS)
      }
      // لو في شغل، يكرر فوراً من غير انتظار
    } catch (err) {
      console.error('[worker] خطأ غير متوقع في الـ loop:', err)
      await sleep(5000)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
