'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Film, Loader2, RefreshCw, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadToStorage } from '@/lib/storage-upload'
import { cn } from '@/lib/utils'
import {
  getVideoUploadUrl,
  confirmVideoUpload,
  getVideoStatus,
  type VideoStatus,
} from '@/lib/video-actions'

// ---------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------
export function VideoUploadField({
  value,
  onChange,
  label = 'فيديو الدرس',
  hint,
  // وضع R2 streaming — لو undefined أو false يُستخدم UploadThing القديم
  streamingEnabled = false,
  lessonId,
}: {
  value: string
  onChange: (url: string) => void
  label?: string
  hint?: string
  streamingEnabled?: boolean
  lessonId?: string
}) {
  // حالة الرفع العادي (UploadThing legacy)
  const [uploading, setUploading]         = useState(false)
  const inputRef                           = useRef<HTMLInputElement>(null)

  // حالة R2 streaming
  const [uploadProgress, setUploadProgress] = useState(0)          // 0-100
  const [uploadPhase, setUploadPhase]        = useState<
    'idle' | 'uploading' | 'processing' | 'ready' | 'error'
  >('idle')
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage]   = useState('')
  const pollingRef                           = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------------------------------------------------------------
  // Polling حالة التحويل
  // ---------------------------------------------------------------
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback(
    (videoId: string) => {
      stopPolling()
      pollingRef.current = setInterval(async () => {
        const record = await getVideoStatus(videoId)
        if (!record) return

        if (record.status === 'ready') {
          stopPolling()
          setUploadPhase('ready')
          setStatusMessage(
            record.durationSec
              ? `جاهز — ${Math.floor(record.durationSec / 60)}:${String(record.durationSec % 60).padStart(2, '0')}`
              : 'الفيديو جاهز للتشغيل',
          )
          // أبلّغ الـ parent بمعرّف الفيديو (ليس URL مباشر — البوابة هتحمي التشغيل)
          onChange(`__video_id:${videoId}`)
          toast.success('اكتمل تحويل الفيديو!')
        } else if (record.status === 'error') {
          stopPolling()
          setUploadPhase('error')
          setStatusMessage(record.errorMessage ?? 'فشل التحويل')
          toast.error(`فشل التحويل: ${record.errorMessage}`)
        } else {
          setUploadPhase('processing')
          setStatusMessage('جاري التحويل إلى صيغ HLS...')
        }
      }, 4000) // كل 4 ثواني
    },
    [stopPolling, onChange],
  )

  useEffect(() => () => stopPolling(), [stopPolling])

  // ---------------------------------------------------------------
  // R2 Direct Upload
  // ---------------------------------------------------------------
  async function handleR2Upload(file: File) {
    if (!lessonId) {
      toast.error('lessonId مطلوب لوضع الـ streaming')
      return
    }
    if (!file.type.startsWith('video/')) {
      toast.error('من فضلك اختر ملف فيديو')
      return
    }

    setUploadPhase('uploading')
    setUploadProgress(0)
    setStatusMessage('جاري إعداد الرفع...')

    // الخطوة 1: احصل على presigned URL + videoId
    const result = await getVideoUploadUrl(lessonId, file.name, file.type)
    if ('error' in result) {
      setUploadPhase('error')
      setStatusMessage(result.error)
      toast.error(result.error)
      return
    }
    const { uploadUrl, videoId } = result
    setCurrentVideoId(videoId)
    setStatusMessage('جاري رفع الفيديو إلى R2...')

    // الخطوة 2: رفع مباشر لـ R2 مع XHR عشان نتابع التقدّم
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        }
        xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('network error'))
        xhr.send(file)
      })
    } catch (err: any) {
      setUploadPhase('error')
      setStatusMessage(err?.message ?? 'فشل الرفع')
      toast.error(`فشل الرفع: ${err?.message}`)
      return
    }

    setUploadProgress(100)
    setStatusMessage('تأكيد الرفع وإضافة مهمة التحويل...')

    // الخطوة 3: أبلّغ السيرفر لإنشاء job + تصحية الوركر
    const confirm = await confirmVideoUpload(videoId, lessonId, file.size)
    if ('error' in confirm) {
      setUploadPhase('error')
      setStatusMessage(confirm.error)
      toast.error(confirm.error)
      return
    }

    setUploadPhase('processing')
    setStatusMessage('الفيديو في طابور التحويل... قد يستغرق بضع دقائق')
    toast.success('اكتمل الرفع! جاري تحويل الفيديو.')

    // الخطوة 4: ابدأ الـ polling
    startPolling(videoId)
  }

  // ---------------------------------------------------------------
  // Legacy UploadThing Upload
  // ---------------------------------------------------------------
  async function handleLegacyFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      toast.error('من فضلك اختر ملف فيديو')
      return
    }
    setUploading(true)
    try {
      const url = await uploadToStorage(file, 'videos')
      onChange(url)
      toast.success('تم رفع الفيديو')
    } catch (e) {
      toast.error(`فشل الرفع: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`)
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (streamingEnabled) {
      void handleR2Upload(file)
    } else {
      void handleLegacyFile(file)
    }
  }

  // ---------------------------------------------------------------
  // حالة العرض
  // ---------------------------------------------------------------
  const isStreaming     = streamingEnabled
  const isLegacyUrl     = value && !value.startsWith('__video_id:')
  const isVideoReady    = uploadPhase === 'ready' || (value?.startsWith('__video_id:') ?? false)
  const isProcessing    = uploadPhase === 'processing'
  const isUploading     = uploadPhase === 'uploading'
  const hasError        = uploadPhase === 'error'
  const isBusy          = isUploading || isProcessing || uploading
  const videoIdValue    = value?.startsWith('__video_id:') ? value.replace('__video_id:', '') : null

  const statusIcon: Record<VideoStatus | 'idle' | 'uploading' | 'processing', React.ReactNode> = {
    idle:       null,
    uploading:  <Loader2 className="size-4 animate-spin text-primary" />,
    processing: <Loader2 className="size-4 animate-spin text-amber-500" />,
    ready:      <CheckCircle2 className="size-4 text-emerald-500" />,
    error:      <AlertCircle className="size-4 text-destructive" />,
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">{label}</label>
        {isStreaming && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            HLS Streaming
          </span>
        )}
      </div>

      {/* Preview */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-secondary/40">
        {isLegacyUrl ? (
          <>
            <video key={value} src={value} controls className="aspect-video w-full bg-black" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-background/90 text-muted-foreground shadow hover:text-destructive"
              aria-label="إزالة الفيديو"
            >
              <X className="size-4" />
            </button>
          </>
        ) : isVideoReady && videoIdValue ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-emerald-950/20 text-emerald-400">
            <CheckCircle2 className="size-10" />
            <p className="text-sm font-semibold">الفيديو جاهز (HLS)</p>
            <p className="text-xs text-muted-foreground">{statusMessage}</p>
            <button
              type="button"
              onClick={() => { onChange(''); setUploadPhase('idle'); setCurrentVideoId(null) }}
              className="mt-1 text-xs text-muted-foreground underline hover:text-destructive"
            >
              حذف وإعادة الرفع
            </button>
          </div>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Film className="size-8" />
            <p className="text-xs">لا يوجد فيديو بعد</p>
          </div>
        )}
      </div>

      {/* Progress bar (R2 mode) */}
      {isStreaming && (isUploading || isProcessing) && (
        <div className="space-y-1.5 rounded-xl border border-border bg-secondary/40 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-foreground">
              {statusIcon[uploadPhase]}
              {statusMessage}
            </span>
            {isUploading && <span className="font-mono text-muted-foreground">{uploadProgress}%</span>}
          </div>
          {isUploading && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          {isProcessing && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full animate-pulse rounded-full bg-amber-500/60" style={{ width: '100%' }} />
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{statusMessage}</span>
          <button
            type="button"
            onClick={() => { setUploadPhase('idle'); setCurrentVideoId(null) }}
            className="flex items-center gap-1 text-xs underline"
          >
            <RefreshCw className="size-3" /> إعادة المحاولة
          </button>
        </div>
      )}

      {/* Upload zone */}
      {!isBusy && !isVideoReady && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-center transition-colors hover:bg-secondary/60',
              isBusy && 'cursor-not-allowed opacity-70',
            )}
          >
            <Upload className="size-7 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">اختر فيديو لرفعه</span>
            <span className="text-xs text-muted-foreground">
              {isStreaming
                ? 'MP4 أو MOV — سيتم تحويله تلقائياً إلى HLS'
                : 'MP4 أو MOV أو WebM (أقل من 500 MB)'}
            </span>
          </button>
        </>
      )}

      {hint && <p className="text-right text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
