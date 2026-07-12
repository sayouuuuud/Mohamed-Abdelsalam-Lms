'use server'

/**
 * lib/video-actions.ts — Server Actions لنظام رفع الفيديو على R2
 *
 * التدفّق:
 *  1. getVideoUploadUrl()   → presigned PUT URL لرفع الملف الخام من المتصفح مباشرة
 *  2. confirmVideoUpload()  → بعد نجاح الرفع: يُنشئ سجل videos + video_jobs + يُحدّث lessons.video_id + يصحّي الوركر
 *  3. getVideoStatus()      → يُرجع حالة الفيديو لعرض شريط التقدّم
 *  4. getStreamingEnabled() → يقرأ streaming_settings.enabled
 */

import { createClient as createAdminClient } from '@/lib/supabase/server'
import { createR2UploadUrl, r2Keys } from '@/lib/r2'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------
export type VideoStatus = 'pending' | 'processing' | 'ready' | 'error'

export type VideoRecord = {
  id:           string
  lessonId:     string
  r2RawKey:     string
  r2HlsPrefix:  string | null
  status:       VideoStatus
  durationSec:  number | null
  errorMessage: string | null
  renditions:   { quality: string; bandwidth: number }[] | null
}

// ---------------------------------------------------------------
// 1. getVideoUploadUrl — يُرجع presigned PUT URL + videoId مبدئي
//    يستدعيها المتصفح قبل الرفع
// ---------------------------------------------------------------
export async function getVideoUploadUrl(
  lessonId:    string,
  fileName:    string,
  contentType: string,
): Promise<{ uploadUrl: string; videoId: string; r2Key: string } | { error: string }> {
  try {
    const supabase = await createAdminClient()

    // تأكد المستخدم أدمن
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'غير مسجّل' }
    const { data: adminRow } = await supabase
      .from('admins').select('id').eq('user_id', user.id).single()
    if (!adminRow) return { error: 'غير مصرّح' }

    // أنشئ سجل video أولي بـ status='pending'
    const ext     = fileName.split('.').pop()?.toLowerCase() ?? 'mp4'
    const { data: vid, error: insErr } = await supabase
      .from('videos')
      .insert({ lesson_id: lessonId, status: 'pending' })
      .select('id')
      .single()
    if (insErr || !vid) return { error: insErr?.message ?? 'خطأ في إنشاء السجل' }

    const videoId = vid.id as string
    const r2Key   = r2Keys.raw(videoId, ext)

    // احفظ المسار الخام في السجل
    await supabase.from('videos').update({ r2_raw_key: r2Key }).eq('id', videoId)

    // احصل على presigned PUT URL (صلاحية 30 دقيقة للملفات الكبيرة)
    const uploadUrl = await createR2UploadUrl(r2Key, contentType, 1800)

    return { uploadUrl, videoId, r2Key }
  } catch (err: any) {
    return { error: err?.message ?? 'خطأ غير متوقع' }
  }
}

// ---------------------------------------------------------------
// 2. confirmVideoUpload — يُستدعى بعد نجاح الرفع لـ R2
//    يُحدّث السجل → يُنشئ job → يُحدّث lessons.video_id → يصحّي الوركر
// ---------------------------------------------------------------
export async function confirmVideoUpload(
  videoId:      string,
  lessonId:     string,
  fileSizeBytes: number,
): Promise<{ ok: true } | { error: string }> {
  try {
    const supabase = await createAdminClient()

    // تأكد المستخدم أدمن
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'غير مسجّل' }
    const { data: adminRow } = await supabase
      .from('admins').select('id').eq('user_id', user.id).single()
    if (!adminRow) return { error: 'غير مصرّح' }

    // حدّث حالة الفيديو لـ processing + حجم الملف
    const { error: updErr } = await supabase
      .from('videos')
      .update({
        status:          'processing',
        file_size_bytes: fileSizeBytes,
        r2_hls_prefix:   r2Keys.hlsPrefix(videoId),
      })
      .eq('id', videoId)
    if (updErr) return { error: updErr.message }

    // أنشئ job في الطابور
    const { error: jobErr } = await supabase
      .from('video_jobs')
      .insert({ video_id: videoId, status: 'queued' })
    if (jobErr) return { error: jobErr.message }

    // اربط الفيديو بالدرس
    const { error: lsnErr } = await supabase
      .from('lessons')
      .update({ video_id: videoId })
      .eq('id', lessonId)
    if (lsnErr) return { error: lsnErr.message }

    // صحّي الوركر لو عنده URL (scale-to-zero wake)
    const wakeUrl    = process.env.WORKER_WAKE_URL
    const wakeSecret = process.env.WORKER_WAKE_SECRET
    if (wakeUrl) {
      try {
        await fetch(wakeUrl, {
          method:  'POST',
          headers: {
            'Content-Type':    'application/json',
            ...(wakeSecret ? { 'x-wake-secret': wakeSecret } : {}),
          },
          body: JSON.stringify({ videoId }),
          signal: AbortSignal.timeout(5000),
        })
      } catch {
        // الوركر مش حيمنع نجاح العملية لو مش رادّ
        console.warn('[video-actions] worker wake failed (non-fatal)')
      }
    }

    return { ok: true }
  } catch (err: any) {
    return { error: err?.message ?? 'خطأ غير متوقع' }
  }
}

// ---------------------------------------------------------------
// 3. getVideoStatus — polling من الـ UI لمتابعة التحويل
// ---------------------------------------------------------------
export async function getVideoStatus(
  videoId: string,
): Promise<VideoRecord | null> {
  const supabase = await createAdminClient()
  const { data } = await supabase
    .from('videos')
    .select('id, lesson_id, r2_raw_key, r2_hls_prefix, status, duration_sec, error_message, renditions')
    .eq('id', videoId)
    .single()
  if (!data) return null
  return {
    id:           data.id,
    lessonId:     data.lesson_id,
    r2RawKey:     data.r2_raw_key ?? '',
    r2HlsPrefix:  data.r2_hls_prefix ?? null,
    status:       data.status as VideoStatus,
    durationSec:  data.duration_sec ?? null,
    errorMessage: data.error_message ?? null,
    renditions:   data.renditions ?? null,
  }
}

// ---------------------------------------------------------------
// 4. getStreamingSettings — يقرأ streaming_settings للـ UI
// ---------------------------------------------------------------
export async function getStreamingSettings(): Promise<{
  enabled:           boolean
  workerCpuThreads:  number
  workerRamMb:       number
  workerConcurrency: number
  renditions:        any[]
  segmentDurationSec:number
} | null> {
  const supabase = await createAdminClient()
  const { data } = await supabase
    .from('streaming_settings')
    .select('*')
    .eq('id', 1)
    .single()
  if (!data) return null
  return {
    enabled:            data.enabled,
    workerCpuThreads:   data.worker_cpu_threads,
    workerRamMb:        data.worker_ram_mb,
    workerConcurrency:  data.worker_concurrency,
    renditions:         data.renditions ?? [],
    segmentDurationSec: data.segment_duration_sec,
  }
}

// ---------------------------------------------------------------
// 5. saveStreamingSettings — يحفظ الإعدادات من لوحة الأدمن
// ---------------------------------------------------------------
export async function saveStreamingSettings(input: {
  enabled:           boolean
  workerCpuThreads:  number
  workerRamMb:       number
  workerConcurrency: number
  segmentDurationSec:number
}): Promise<{ ok: true } | { error: string }> {
  try {
    const supabase = await createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'غير مسجّل' }
    const { data: adminRow } = await supabase
      .from('admins').select('id').eq('user_id', user.id).single()
    if (!adminRow) return { error: 'غير مصرّح' }

    const { error } = await supabase
      .from('streaming_settings')
      .update({
        enabled:             input.enabled,
        worker_cpu_threads:  input.workerCpuThreads,
        worker_ram_mb:       input.workerRamMb,
        worker_concurrency:  input.workerConcurrency,
        segment_duration_sec:input.segmentDurationSec,
      })
      .eq('id', 1)
    if (error) return { error: error.message }
    return { ok: true }
  } catch (err: any) {
    return { error: err?.message ?? 'خطأ غير متوقع' }
  }
}
