'use server'

import { prisma } from '@/lib/prisma'
import { createR2UploadUrl, r2Keys, isR2Configured, checkR2Connection } from '@/lib/r2'
import { auth } from '@/auth'
import { isStaff } from '@/lib/auth-guard'

export async function testR2Connection(): Promise<{ ok: boolean; message: string }> {
  return checkR2Connection()
}

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

export async function getVideoUploadUrl(
  lessonId:    string | undefined,
  fileName:    string,
  contentType: string,
): Promise<{ uploadUrl: string; videoId: string; r2Key: string } | { error: string }> {
  try {
    if (!isR2Configured()) {
      return { error: 'التخزين السحابي (R2) غير مهيّأ بعد — استخدم الرفع العادي مؤقتاً' }
    }

    const session = await auth()
    const user = session?.user
    if (!user || !user.id) return { error: 'غير مسجّل' }

    if (!(await isStaff())) {
      return { error: 'غير مصرّح' }
    }

    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'mp4'
    // لو lessonId متوفر، نربط الفيديو بالدرس فوراً. لو لأ، سيتم الربط لما يتحفظ الدرس.
    const vid = await prisma.videos.create({
      data: { lesson_id: lessonId ?? null, status: 'pending' },
      select: { id: true }
    })

    if (!vid) return { error: 'خطأ في إنشاء السجل' }

    const videoId = vid.id
    const r2Key   = r2Keys.raw(videoId, ext)

    await prisma.videos.update({
      where: { id: videoId },
      data: { r2_raw_key: r2Key }
    })

    const uploadUrl = await createR2UploadUrl(r2Key, contentType, 1800)

    return { uploadUrl, videoId, r2Key }
  } catch (err: any) {
    return { error: err?.message ?? 'خطأ غير متوقع' }
  }
}

export async function confirmVideoUpload(
  videoId:       string,
  lessonId:      string | undefined,
  fileSizeBytes: number,
): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth()
    const user = session?.user
    if (!user || !user.id) return { error: 'غير مسجّل' }

    if (!(await isStaff())) {
      return { error: 'غير مصرّح' }
    }

    const video = await prisma.videos.findUnique({ where: { id: videoId } })
    if (!video || !video.r2_raw_key) return { error: 'فيديو غير صالح' }
    if (video.status !== 'pending') return { error: 'تم تأكيد الرفع مسبقاً' }

    // التحقق من وجود الملف في R2 باستخدام HeadObject
    const bucket = process.env.R2_BUCKET
    if (!bucket) return { error: 'إعدادات R2 غير مكتملة' }
    
    try {
      const { getR2Client } = await import('@/lib/r2')
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
      const r2Client = getR2Client()
      await r2Client.send(new HeadObjectCommand({ Bucket: bucket, Key: video.r2_raw_key }))
    } catch (err) {
      return { error: 'لم يتم العثور على الملف في التخزين السحابي، تأكد من اكتمال الرفع' }
    }

    const hlsPrefix = r2Keys.hlsPrefix(videoId)

    await prisma.$transaction(async (tx) => {
      await tx.videos.update({
        where: { id: videoId },
        data: {
          status:          'processing',
          file_size_bytes: fileSizeBytes,
          r2_hls_prefix:   hlsPrefix,
        }
      })

      // استخدام upsert لمنع تكرار الـ jobs لو تم الاستدعاء مرتين
      const existingJob = await tx.video_jobs.findFirst({ where: { video_id: videoId } })
      if (!existingJob) {
        await tx.video_jobs.create({
          data: { video_id: videoId, status: 'queued' }
        })
      }

      if (lessonId) {
        await tx.lessons.update({
          where: { id: lessonId },
          data: { video_id: videoId }
        })
      }
    })

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
        console.warn('[video-actions] worker wake failed (non-fatal)')
      }
    }

    return { ok: true }
  } catch (err: any) {
    return { error: err?.message ?? 'خطأ غير متوقع' }
  }
}

export async function getVideoStatus(
  videoId: string,
): Promise<VideoRecord | null> {
  const data = await prisma.videos.findUnique({
    where: { id: videoId },
    select: { id: true, lesson_id: true, r2_raw_key: true, r2_hls_prefix: true, status: true, duration_sec: true, error_message: true, renditions: true }
  })
  if (!data) return null
  return {
    id:           data.id,
    lessonId:     data.lesson_id ?? '',
    r2RawKey:     data.r2_raw_key ?? '',
    r2HlsPrefix:  data.r2_hls_prefix ?? null,
    status:       data.status as VideoStatus,
    durationSec:  data.duration_sec ?? null,
    errorMessage: data.error_message ?? null,
    renditions:   (data.renditions as any) ?? null,
  }
}

export async function getStreamingSettings(): Promise<{
  enabled:            boolean
  r2Configured:      boolean
  workerCpuThreads:  number
  workerRamMb:       number
  workerConcurrency: number
  segmentDurationSec:number
} | null> {
  const data = await prisma.platform_settings.findUnique({
    where: { id: 1 },
    select: { is_streaming_enabled: true, worker_cpu_threads: true, worker_ram_mb: true, worker_concurrency: true, segment_duration_sec: true }
  })

  const r2Configured = isR2Configured()
  return {
    enabled:             (data?.is_streaming_enabled ?? false) && r2Configured,
    r2Configured,
    workerCpuThreads:    data?.worker_cpu_threads  ?? 2,
    workerRamMb:         data?.worker_ram_mb        ?? 2048,
    workerConcurrency:   data?.worker_concurrency   ?? 1,
    segmentDurationSec:  data?.segment_duration_sec ?? 4,
  }
}

export async function saveStreamingSettings(input: {
  enabled:            boolean
  workerCpuThreads:   number
  workerRamMb:        number
  workerConcurrency:  number
  segmentDurationSec: number
}): Promise<{ ok: true } | { error: string }> {
  try {
    await prisma.platform_settings.upsert({
      where: { id: 1 },
      update: {
        is_streaming_enabled:  input.enabled,
        worker_cpu_threads:    input.workerCpuThreads,
        worker_ram_mb:         input.workerRamMb,
        worker_concurrency:    input.workerConcurrency,
        segment_duration_sec:  input.segmentDurationSec,
        updated_at:            new Date(),
      },
      create: {
        id: 1,
        is_streaming_enabled:  input.enabled,
        worker_cpu_threads:    input.workerCpuThreads,
        worker_ram_mb:         input.workerRamMb,
        worker_concurrency:    input.workerConcurrency,
        segment_duration_sec:  input.segmentDurationSec,
      }
    })
    return { ok: true }
  } catch (err: any) {
    console.log('[v0] saveStreamingSettings error:', err.message)
    return { error: 'تعذّر حفظ إعدادات الاستريمنج.' }
  }
}
