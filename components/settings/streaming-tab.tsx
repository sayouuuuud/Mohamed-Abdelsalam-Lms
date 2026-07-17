'use client'

import { useState, useTransition } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Info,
  Layers,
  Loader2,
  MemoryStick,
  RefreshCw,
  Video,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { saveStreamingSettings, testR2Connection } from '@/lib/video-actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------
type Settings = {
  enabled:            boolean
  r2Configured?:      boolean
  workerCpuThreads:   number
  workerRamMb:        number
  workerConcurrency:  number
  segmentDurationSec: number
} | null

type Job = {
  id: string
  status: 'queued' | 'claimed' | 'done' | 'failed'
  attempts: number
  created_at: string
  updated_at: string
  video_id: string
}

type VideoRecord = {
  id: string
  lesson_id: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  duration_sec: number | null
  file_size_bytes: number | null
  created_at: string
  r2_hls_prefix: string | null
  error_message: string | null
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function fmtBytes(b: number | null): string {
  if (!b) return '—'
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function fmtDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const statusStyle: Record<string, string> = {
  queued:     'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
  claimed:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  done:       'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
  failed:     'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
  pending:    'bg-secondary text-muted-foreground border-border',
  processing: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  ready:      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
  error:      'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
}

const statusLabel: Record<string, string> = {
  queued: 'في الطابور', claimed: 'قيد التحويل', done: 'اكتمل', failed: 'فشل',
  pending: 'معلّق', processing: 'يعالج', ready: 'جاهز', error: 'خطأ',
}

// ---------------------------------------------------------------
// SliderField — مع tooltip
// ---------------------------------------------------------------
function SliderField({
  label,
  icon: Icon,
  value,
  min,
  max,
  step = 1,
  unit,
  tooltip,
  onChange,
}: {
  label: string
  icon: typeof Cpu
  value: number
  min: number
  max: number
  step?: number
  unit: string
  tooltip?: string
  onChange: (v: number) => void
}) {
  const [showTip, setShowTip] = useState(false)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{label}</span>
          {tooltip && (
            <button
              type="button"
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              className="relative"
            >
              <Info className="size-3.5 text-muted-foreground" />
              {showTip && (
                <div className="absolute bottom-full right-0 z-20 mb-1 w-48 rounded-lg border border-border bg-popover p-2 text-xs text-muted-foreground shadow-lg">
                  {tooltip}
                </div>
              )}
            </button>
          )}
        </div>
        <span className="text-sm font-semibold text-primary tabular-nums">
          {value.toLocaleString()} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{min.toLocaleString()} {unit}</span>
        <span>{max.toLocaleString()} {unit}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Main Component — يُستخدم كتاب داخل صفحة الإعدادات
// ---------------------------------------------------------------
export function StreamingTab({
  settings: initialSettings,
  jobs,
  videos,
}: {
  settings: Settings
  jobs: Job[]
  videos: VideoRecord[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const r2Configured = initialSettings?.r2Configured ?? false

  const [enabled,         setEnabled]         = useState(initialSettings?.enabled ?? true)
  const [cpuThreads,      setCpuThreads]      = useState(initialSettings?.workerCpuThreads ?? 2)
  const [ramMb,           setRamMb]           = useState(initialSettings?.workerRamMb ?? 2048)
  const [concurrency,     setConcurrency]     = useState(initialSettings?.workerConcurrency ?? 1)
  const [segmentDuration, setSegmentDuration] = useState(initialSettings?.segmentDurationSec ?? 4)

  const [jobsExpanded,   setJobsExpanded]   = useState(true)
  const [videosExpanded, setVideosExpanded] = useState(false)
  const [r2Testing,      setR2Testing]      = useState(false)
  const [r2TestResult,   setR2TestResult]   = useState<{ ok: boolean; message: string } | null>(null)



  const handleTestR2 = async () => {
    setR2Testing(true)
    setR2TestResult(null)
    try {
      const result = await testR2Connection()
      setR2TestResult(result)
    } finally {
      setR2Testing(false)
    }
  }

  const totalVideos    = videos.length
  const readyVideos    = videos.filter((v) => v.status === 'ready').length
  const processingJobs = jobs.filter((j) => j.status === 'claimed').length
  const queuedJobs     = jobs.filter((j) => j.status === 'queued').length
  const failedJobs     = jobs.filter((j) => j.status === 'failed').length

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveStreamingSettings({
        enabled,
        workerCpuThreads:   cpuThreads,
        workerRamMb:        ramMb,
        workerConcurrency:  concurrency,
        segmentDurationSec: segmentDuration,
      })
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('تم حفظ الإعدادات')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">الفيديو والـ Streaming</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            إدارة نظام تحويل الفيديو إلى HLS، موارد الوركر، وحالة الوظائف
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          <RefreshCw className="size-4" />
          تحديث
        </Button>
      </div>

      {/* R2 status banner + diagnostic button */}
      <div className={`flex flex-col gap-3 rounded-xl border p-4 text-sm ${r2Configured ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'}`}>
        <div className="flex items-start gap-3">
          {r2Configured
            ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            : <AlertCircle className="mt-0.5 size-5 shrink-0" />
          }
          <div className="flex-1 space-y-1">
            <p className="font-semibold">
              {r2Configured ? 'Cloudflare R2 مهيّأ' : 'التخزين السحابي (Cloudflare R2) غير مهيّأ بعد'}
            </p>
            {!r2Configured && (
              <p className="text-amber-700 dark:text-amber-400/90">
                نظام الـ HLS Streaming معطّل مؤقتاً، والرفع يتم بالطريقة العادية (MP4 مباشر).
                لتفعيل الـ streaming: اضبط متغيرات <code className="font-mono">R2_*</code> في إعدادات المشروع (Vars)، ثم انشر الوركر.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestR2}
            disabled={r2Testing}
            className="shrink-0"
          >
            {r2Testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            اختبار الاتصال
          </Button>
        </div>

        {/* Test result */}
        {r2TestResult && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${r2TestResult.ok ? 'border-emerald-200 bg-white/60 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-400' : 'border-red-200 bg-white/60 text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-400'}`}>
            {r2TestResult.ok
              ? <CheckCircle2 className="size-4 shrink-0" />
              : <AlertCircle className="size-4 shrink-0" />
            }
            {r2TestResult.message}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'إجمالي الفيديوهات', value: totalVideos, icon: Video,        color: 'text-primary' },
          { label: 'جاهزة HLS',          value: readyVideos, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'في الطابور',          value: queuedJobs,  icon: Clock,        color: 'text-amber-500' },
          { label: 'فشلت',               value: failedJobs,  icon: AlertCircle,  color: 'text-destructive' },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-3 p-4">
            <div className={cn('rounded-xl bg-secondary p-2', stat.color)}>
              <stat.icon className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Worker settings */}
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">إعدادات الـ Worker</h3>
          </div>

          {/* تفعيل/إيقاف Streaming */}
          <label
            className={cn(
              'flex items-center gap-2.5',
              r2Configured ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
            )}
            title={r2Configured ? undefined : 'اضبط متغيرات R2 أولاً لتفعيل النظام'}
          >
            <span className="text-sm font-medium text-foreground">تفعيل نظام Streaming</span>
            <div
              onClick={() => { if (r2Configured) setEnabled((v) => !v) }}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                r2Configured ? 'cursor-pointer' : 'cursor-not-allowed',
                enabled && r2Configured ? 'bg-primary' : 'bg-secondary',
              )}
            >
              <span
                className={cn(
                  'inline-block size-4 rounded-full bg-white shadow transition-transform',
                  enabled && r2Configured ? 'translate-x-1' : 'translate-x-6',
                )}
              />
            </div>
          </label>
        </div>

        {!enabled && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            <Info className="size-4 shrink-0" />
            نظام Streaming موقوف — الفيديوهات الجديدة ستُرفع بالطريقة القديمة (MP4 مباشر).
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SliderField
            label="خيوط الـ CPU"
            icon={Cpu}
            value={cpuThreads}
            min={1}
            max={32}
            unit="thread"
            tooltip="عدد خيوط CPU التي سيستخدمها FFmpeg أثناء التحويل. كلما زاد العدد كلما سرّع التحويل لكن استهلك موارد أكثر."
            onChange={setCpuThreads}
          />
          <SliderField
            label="حدّ الـ RAM"
            icon={MemoryStick}
            value={ramMb}
            min={512}
            max={16384}
            step={512}
            unit="MB"
            tooltip="الحدّ الأقصى للذاكرة المسموح للوركر باستخدامها. الفيديوهات عالية الجودة تحتاج ذاكرة أكبر."
            onChange={setRamMb}
          />
          <SliderField
            label="عدد التحويلات المتزامنة"
            icon={Layers}
            value={concurrency}
            min={1}
            max={8}
            unit="وظيفة"
            tooltip="عدد الفيديوهات التي يعالجها الوركر بالتوازي. اتركه 1 لو السيرفر ضعيف."
            onChange={setConcurrency}
          />
          <SliderField
            label="مدة الـ Segment"
            icon={Activity}
            value={segmentDuration}
            min={2}
            max={10}
            unit="ثانية"
            tooltip="طول كل قطعة HLS بالثواني. 4 ثواني هو الافتراضي الموصى به للتوازن بين الاستجابة ووقت البداية."
            onChange={setSegmentDuration}
          />
        </div>

        {/* Worker env hint */}
        <div className="mt-5 rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">متغيرات بيئة الوركر (Worker env)</p>
          <p>الوركر يقرأ هذه الإعدادات تلقائياً من قاعدة البيانات عند كل وظيفة، لكنه يحتاج إلى:</p>
          <div dir="ltr" className="mt-2 grid grid-cols-1 gap-1 font-mono sm:grid-cols-2">
            {[
              'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
              'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID',
              'R2_SECRET_ACCESS_KEY', 'R2_BUCKET',
            ].map((k) => (
              <span key={k} className="rounded bg-secondary px-2 py-0.5 text-foreground">{k}</span>
            ))}
          </div>
          <p className="mt-2">
            تأكد من ضبطها في بيئة الـ Worker قبل تشغيله.
            رابط تصحية الوركر (<code className="font-mono">WORKER_WAKE_URL</code>) اختياري للـ scale-to-zero.
          </p>
        </div>

        <div className="mt-5 flex justify-start">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            حفظ الإعدادات
          </Button>
        </div>
      </Card>

      {/* Video Jobs */}
      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setJobsExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-secondary/30"
        >
          <div className="flex items-center gap-2">
            <Database className="size-5 text-primary" />
            <h3 className="font-bold text-foreground">
              وظائف التحويل
              {processingJobs > 0 && (
                <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                  <Loader2 className="size-3 animate-spin" />
                  {processingJobs} يعالج
                </span>
              )}
            </h3>
          </div>
          {jobsExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>

        {jobsExpanded && (
          <div className="overflow-x-auto border-t border-border">
            {jobs.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                لا توجد وظائف بعد — سيظهر هنا كل فيديو يترفع
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/30">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">الحالة</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">معرّف الفيديو</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">المحاولات</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">وقت الإنشاء</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">آخر تحديث</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', statusStyle[job.status])}>
                          {job.status === 'claimed' && <Loader2 className="ml-1 size-3 animate-spin" />}
                          {statusLabel[job.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {job.video_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 tabular-nums">{job.attempts}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(job.created_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(job.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>

      {/* Videos */}
      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setVideosExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-secondary/30"
        >
          <div className="flex items-center gap-2">
            <HardDrive className="size-5 text-primary" />
            <h3 className="font-bold text-foreground">مكتبة الفيديوهات ({totalVideos})</h3>
          </div>
          {videosExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>

        {videosExpanded && (
          <div className="overflow-x-auto border-t border-border">
            {videos.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">لا توجد فيديوهات بعد</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/30">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">الحالة</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">المدة</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">الحجم</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">HLS Prefix</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">تاريخ الرفع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {videos.map((v) => (
                    <tr key={v.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', statusStyle[v.status])}>
                          {v.status === 'processing' && <Loader2 className="size-3 animate-spin" />}
                          {statusLabel[v.status]}
                        </span>
                        {v.error_message && (
                          <p className="mt-0.5 text-[10px] text-destructive">{v.error_message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{fmtDuration(v.duration_sec)}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtBytes(v.file_size_bytes)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {v.r2_hls_prefix ? v.r2_hls_prefix.slice(0, 20) + '…' : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(v.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>

    </div>
  )
}
