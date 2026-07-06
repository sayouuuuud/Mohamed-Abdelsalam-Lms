'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlarmClock,
  Award,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileQuestion,
  ListChecks,
  Play,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExamStatus } from '@/lib/student-exams-data'

// Shape returned by getStudentExams() server action.
type ExamListItem = {
  id: string
  title: string
  course: string
  category: string
  status: ExamStatus
  pending: boolean
  questionsCount: number
  durationMinutes: number
  totalPoints: number
  passingPercent: number
  score: number | null
  date: string
  time: string
}

type Filter = 'all' | ExamStatus

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'متاح', label: 'متاحة الآن' },
  { key: 'قادم', label: 'قادمة' },
  { key: 'مكتمل', label: 'مكتملة' },
]

const statusConfig: Record<
  ExamStatus,
  { label: string; badge: string; bar: string; accent: string; icon: typeof Clock }
> = {
  متاح: {
    label: 'متاح الآن',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
    accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    icon: AlarmClock,
  },
  قادم: {
    label: 'قادم',
    badge: 'bg-primary/15 text-primary',
    bar: 'bg-primary',
    accent: 'bg-primary/10 text-primary',
    icon: CalendarClock,
  },
  مكتمل: {
    label: 'مكتمل',
    badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    bar: 'bg-blue-500',
    accent: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    icon: CheckCircle2,
  },
}

function ExamCard({ exam }: { exam: ExamListItem }) {
  const cfg = statusConfig[exam.status] ?? statusConfig['قادم']
  const StatusIcon = cfg.icon
  const percent =
    exam.score != null ? Math.round((exam.score / exam.totalPoints) * 100) : null
  const passed = percent != null && percent >= exam.passingPercent

  return (
    <Card className="group flex flex-col gap-0 overflow-hidden p-0 transition-shadow hover:shadow-md hover:border-primary/40">
      {/* Accent header */}
      <div className="flex items-center justify-between gap-3 border-b border-border p-5 pb-4">
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl',
            cfg.accent,
          )}
        >
          <ClipboardList className="size-5" />
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold',
            cfg.badge,
          )}
        >
          <StatusIcon className="size-3.5" />
          {cfg.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {exam.category}
          </span>
        </div>

        <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug text-foreground text-balance">
          {exam.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{exam.course}</p>

        <div className="mt-4 grid grid-cols-2 gap-y-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileQuestion className="size-3.5" />
            {exam.questionsCount} أسئلة
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {exam.durationMinutes} دقيقة
          </span>
          <span className="flex items-center gap-1.5">
            <Award className="size-3.5" />
            {exam.totalPoints} نقطة
          </span>
          <span className="flex items-center gap-1.5">
            <Target className="size-3.5" />
            نجاح {exam.passingPercent}%
          </span>
        </div>

        {exam.status === 'مكتمل' && percent != null ? (
          <div className="mt-4 rounded-xl bg-secondary/60 p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">نتيجتك</span>
              <span
                className={cn(
                  'font-bold',
                  passed
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-destructive',
                )}
              >
                {exam.score}/{exam.totalPoints} ({percent}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
              <div
                className={cn(
                  'h-full rounded-full',
                  passed ? 'bg-emerald-500' : 'bg-destructive',
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-secondary/60 px-3 py-2.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            <span className="font-medium text-foreground">{exam.date}</span>
            {exam.time !== '—' && <span>· {exam.time}</span>}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          {exam.status === 'قادم' ? (
            <Button variant="secondary" className="w-full" disabled>
              <Clock className="size-4" />
              لم يبدأ بعد
            </Button>
          ) : (
            <Button
              className="w-full"
              variant={exam.status === 'مكتمل' ? 'outline' : 'default'}
              nativeButton={false}
              render={<Link href={`/student/exams/${exam.id}`} />}
            >
              {exam.status === 'مكتمل' ? (
                <>
                  <ListChecks className="size-4" />
                  مراجعة الإجابات
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  بدء الاختبار
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

export function StudentExamsPage({ exams = [] }: { exams?: ExamListItem[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exams.filter((e) => {
      const matchesStatus = filter === 'all' || e.status === filter
      const matchesQuery =
        q === '' ||
        e.title.toLowerCase().includes(q) ||
        e.course.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      return matchesStatus && matchesQuery
    })
  }, [filter, query])

  const available = exams.filter((e) => e.status === 'متاح').length
  const upcoming = exams.filter((e) => e.status === 'قادم').length
  const completed = exams.filter((e) => e.status === 'مكتمل')
  // Only include graded submissions that have a real totalPoints > 0 in the average.
  const gradedWithPoints = completed.filter(
    (e) => e.score !== null && e.totalPoints > 0,
  )
  const avgScore =
    gradedWithPoints.length > 0
      ? Math.round(
          gradedWithPoints.reduce(
            (a, e) => a + ((e.score ?? 0) / e.totalPoints) * 100,
            0,
          ) / gradedWithPoints.length,
        )
      : 0

  const stats = [
    {
      label: 'متاحة الآن',
      value: String(available),
      sub: 'جاهزة للحل',
      icon: AlarmClock,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'اختبارات قادمة',
      value: String(upcoming),
      sub: 'مجدولة قريباً',
      icon: CalendarClock,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'مكتملة',
      value: String(completed.length),
      sub: 'تم تسليمها',
      icon: CheckCircle2,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'متوسط الدرجات',
      value: `${avgScore}%`,
      sub: 'في الاختبارات المكتملة',
      icon: Award,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">الاختبارات</h1>
        <p className="text-sm text-muted-foreground">
          تابع اختباراتك المتاحة والقادمة، وراجع نتائج اختباراتك السابقة.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="gap-0 p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl',
                  stat.bg,
                )}
              >
                <stat.icon className={cn('size-5', stat.color)} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                {stat.value}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{stat.sub}</p>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <Card className="gap-0 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم الاختبار أو الكورس أو التصنيف..."
              className="h-11 w-full rounded-xl border border-border bg-secondary/60 pr-10 pl-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded-lg border px-4 py-2 text-xs font-semibold transition-colors',
                  filter === f.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ClipboardList className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              لا توجد اختبارات مطابقة لبحثك.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            عرض <strong className="text-foreground">{filtered.length}</strong> من
            أصل <strong className="text-foreground">{exams.length}</strong> اختبار
          </span>
          <span className="flex items-center gap-1 font-semibold text-emerald-600">
            <TrendingUp className="size-3.5" />
            {avgScore}% متوسط النجاح
          </span>
        </div>
      </Card>
    </div>
  )
}
