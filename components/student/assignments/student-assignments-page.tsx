'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Award,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  ListChecks,
  Search,
  Send,
  Hourglass,
  TrendingUp,
  CircleDashed,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AssignmentStatus } from '@/lib/student-types'

// Shape returned by getStudentAssignments() server action.
type AssignmentListItem = {
  id: string
  courseId: string
  lectureTitle: string
  title: string
  type: 'تسليم' | 'اختبار'
  description: string
  instructions: string[]
  dueDate: string
  points: number
  score: number | null
  status: AssignmentStatus
  attachments: { name: string; size: string }[]
}

type Filter = 'all' | AssignmentStatus

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'لم يبدأ', label: 'لم تبدأ' },
  { key: 'قيد التنفيذ', label: 'قيد التنفيذ' },
  { key: 'تم التسليم', label: 'تم التسليم' },
  { key: 'مصحّح', label: 'مصحّحة' },
]

const statusConfig: Record<
  AssignmentStatus,
  { label: string; badge: string; accent: string; icon: typeof Hourglass }
> = {
  'لم يبدأ': {
    label: 'لم يبدأ',
    badge: 'bg-secondary text-muted-foreground',
    accent: 'bg-secondary text-muted-foreground',
    icon: CircleDashed,
  },
  'قيد التنفيذ': {
    label: 'قيد التنفيذ',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    accent: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    icon: Hourglass,
  },
  'تم التسليم': {
    label: 'تم التسليم',
    badge: 'bg-primary/15 text-primary',
    accent: 'bg-primary/10 text-primary',
    icon: Send,
  },
  'مصحّح': {
    label: 'مصحّح',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    icon: CheckCircle2,
  },
}

function AssignmentCard({ assignment }: { assignment: AssignmentListItem }) {
  const cfg = statusConfig[assignment.status] ?? statusConfig['لم يبدأ']
  const StatusIcon = cfg.icon
  const isQuiz = assignment.type === 'اختبار'
  const courseTitle = assignment.lectureTitle
  const percent =
    assignment.score != null
      ? Math.round((assignment.score / assignment.points) * 100)
      : null

  const cta =
    assignment.status === 'مصحّح'
      ? { label: 'عرض النتيجة', icon: ListChecks, variant: 'outline' as const }
      : assignment.status === 'تم التسليم'
        ? { label: 'عرض التسليم', icon: ClipboardCheck, variant: 'outline' as const }
        : isQuiz
          ? { label: 'بدء الاختبار', icon: ClipboardList, variant: 'default' as const }
          : { label: 'تسليم الواجب', icon: Send, variant: 'default' as const }
  const CtaIcon = cta.icon

  return (
    <Card className="group flex flex-col gap-0 overflow-hidden p-0 transition-shadow hover:border-primary/40 hover:shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-border p-5 pb-4">
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl',
            cfg.accent,
          )}
        >
          {isQuiz ? (
            <ClipboardList className="size-5" />
          ) : (
            <FileText className="size-5" />
          )}
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
            {assignment.type}
          </span>
        </div>

        <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug text-foreground text-balance">
          {assignment.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{courseTitle}</p>

        <div className="mt-4 grid grid-cols-2 gap-y-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Award className="size-3.5" />
            {assignment.points} نقطة
          </span>
          <span className="flex items-center gap-1.5">
            {isQuiz ? (
              <>
                <ClipboardList className="size-3.5" />
                اختبار
              </>
            ) : (
              <>
                <FileText className="size-3.5" />
                تسليم
              </>
            )}
          </span>
        </div>

        {assignment.status === 'مصحّح' && percent != null ? (
          <div className="mt-4 rounded-xl bg-secondary/60 p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">درجتك</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {assignment.score}/{assignment.points} ({percent}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-secondary/60 px-3 py-2.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            <span>موعد التسليم</span>
            <span className="font-medium text-foreground">{assignment.dueDate}</span>
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <Button
            className="w-full"
            variant={cta.variant}
            nativeButton={false}
            render={<Link href={`/student/assignments/${assignment.id}`} />}
          >
            <CtaIcon className="size-4" />
            {cta.label}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export function StudentAssignmentsPage({ assignments = [] }: { assignments?: AssignmentListItem[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assignments.filter((a) => {
      const matchesStatus = filter === 'all' || a.status === filter
      const matchesQuery =
        q === '' ||
        a.title.toLowerCase().includes(q) ||
        a.lectureTitle.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
      return matchesStatus && matchesQuery
    })
  }, [filter, query, assignments])

  const pending = assignments.filter(
    (a) => a.status === 'لم يبدأ' || a.status === 'قيد التنفيذ',
  ).length
  const submitted = assignments.filter((a) => a.status === 'تم التسليم').length
  const graded = assignments.filter((a) => a.status === 'مصحّح')
  const gradedWithScore = graded.filter((a) => a.score !== null && a.points > 0)
  const avgScore =
    gradedWithScore.length > 0
      ? Math.round(
          gradedWithScore.reduce(
            (acc, a) => acc + ((a.score ?? 0) / a.points) * 100,
            0,
          ) / gradedWithScore.length,
        )
      : 0

  const stats = [
    {
      label: 'مطلوبة منك',
      value: String(pending),
      sub: 'لم تُسلّم بعد',
      icon: Hourglass,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
    {
      label: 'تم تسليمها',
      value: String(submitted),
      sub: 'بانتظار التصحيح',
      icon: Send,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'مصحّحة',
      value: String(graded.length),
      sub: 'تم تقييمها',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'متوسط الدرجات',
      value: `${avgScore}%`,
      sub: 'في الواجبات المصحّحة',
      icon: Award,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">الواجبات</h1>
        <p className="text-sm text-muted-foreground">
          تابع واجباتك المطلوبة، سلّم حلولك في الموعد، وراجع درجات الواجبات المصحّحة.
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
              placeholder="ابحث باسم الواجب أو الكورس أو النوع..."
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
              لا توجد واجبات مطابقة لبحثك.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            عرض <strong className="text-foreground">{filtered.length}</strong> من
            أصل <strong className="text-foreground">{assignments.length}</strong>{' '}
            واجب
          </span>
          <span className="flex items-center gap-1 font-semibold text-emerald-600">
            <TrendingUp className="size-3.5" />
            {avgScore}% متوسط الدرجات
          </span>
        </div>
      </Card>
    </div>
  )
}
