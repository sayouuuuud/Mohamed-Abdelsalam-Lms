'use client'

import { useState, useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StudentProfile } from '@/lib/student-profile-data'

const progressConfig: ChartConfig = {
  progress: { label: 'نسبة التقدم', color: 'var(--chart-1)' },
}
const spendConfig: ChartConfig = {
  amount: { label: 'الإنفاق (ج.م)', color: 'var(--chart-2)' },
}
const skillsConfig: ChartConfig = {
  examAvg: { label: 'متوسط الامتحانات', color: 'var(--chart-1)' },
  courseProgress: { label: 'تقدّم المحاضرات', color: 'var(--chart-2)' },
}
const breakdownConfig: ChartConfig = {
  value: { label: 'الواجبات' },
}

const pieColors = ['var(--chart-2)', 'var(--chart-4)', 'var(--chart-5)']

// Arabic day names (short)
const arDays = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const arMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

type Range = '7' | '14' | '30' | 'all'

/** Build progress trend from raw lesson completion dates */
function buildProgressTrend(
  completedLessonDates: string[],
  totalLessonsAll: number,
  range: Range,
): { label: string; progress: number }[] {
  const now = Date.now()
  const completedDates = completedLessonDates.map((d) => new Date(d))

  if (range === 'all') {
    // 6-month monthly view
    const buckets = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      d.setDate(1)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const doneByThen = completedDates.filter((cd) => cd <= endOfMonth).length
      const progress = totalLessonsAll > 0 ? Math.round((doneByThen / totalLessonsAll) * 100) : 0
      return { label: arMonths[d.getMonth()], progress }
    })
    return buckets
  }

  // Day-by-day for 7/14/30
  const days = parseInt(range)
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000)
  
  // lessons completed BEFORE the cutoff (baseline)
  const baselineDone = completedDates.filter((d) => d < cutoff).length
  
  // Build cumulative per-day
  const buckets: { label: string; progress: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now - i * 24 * 60 * 60 * 1000)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)
    const doneThatDay = completedDates.filter((d) => d >= dayStart && d <= dayEnd).length
    // For daily view, show lessons done that day (not cumulative)
    const progress = totalLessonsAll > 0 ? Math.round((doneThatDay / totalLessonsAll) * 100) : 0
    const label = days === 7
      ? arDays[dayStart.getDay()]
      : `${dayStart.getDate()}/${dayStart.getMonth() + 1}`
    buckets.push({ label, progress })
  }
  return buckets
}

/** Build spend trend from raw orders */
function buildSpendTrend(
  rawOrders: Array<{ date: string; amount: number }>,
  range: Range,
): { label: string; amount: number }[] {
  const now = Date.now()
  const orders = rawOrders.map((o) => ({ ...o, dateObj: new Date(o.date) }))

  if (range === 'all') {
    // 6-month monthly view
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      d.setDate(1)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
      const amount = orders
        .filter((o) => o.dateObj >= startOfMonth && o.dateObj <= endOfMonth)
        .reduce((s, o) => s + o.amount, 0)
      return { label: arMonths[d.getMonth()], amount }
    })
  }

  const days = parseInt(range)
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000)
  const periodOrders = orders.filter((o) => o.dateObj >= cutoff)

  // day-by-day
  const buckets: { label: string; amount: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now - i * 24 * 60 * 60 * 1000)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)
    const amount = periodOrders
      .filter((o) => o.dateObj >= dayStart && o.dateObj <= dayEnd)
      .reduce((s, o) => s + o.amount, 0)
    const label = days === 7
      ? arDays[dayStart.getDay()]
      : `${dayStart.getDate()}/${dayStart.getMonth() + 1}`
    buckets.push({ label, amount })
  }
  return buckets
}



function FilterSelect({
  value,
  onChange,
  allLabel = "الكل",
}: {
  value: Range
  onChange: (v: Range) => void
  allLabel?: string
}) {
  const labels: Record<Range, string> = {
    '7': 'آخر 7 أيام',
    '14': 'آخر 14 يوم',
    '30': 'آخر 30 يوم',
    'all': allLabel,
  }

  return (
    <Select value={value} onValueChange={(v) => onChange(v as Range)}>
      <SelectTrigger className="h-8 w-[130px] bg-secondary/60 text-xs text-foreground transition-colors hover:bg-secondary focus:border-primary focus:ring-1 focus:ring-primary/20">
        <span>{labels[value]}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">آخر 7 أيام</SelectItem>
        <SelectItem value="14">آخر 14 يوم</SelectItem>
        <SelectItem value="30">آخر 30 يوم</SelectItem>
        <SelectItem value="all">{allLabel}</SelectItem>
      </SelectContent>
    </Select>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
  filter,
  onFilterChange,
  allLabel,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  filter?: Range
  onFilterChange?: (v: Range) => void
  allLabel?: string
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 text-right">
          <h3 className="font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {onFilterChange && filter !== undefined && (
          <FilterSelect value={filter} onChange={onFilterChange} allLabel={allLabel} />
        )}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

export function ProfileCharts({ profile }: { profile: StudentProfile }) {
  const [progressFilter, setProgressFilter] = useState<Range>('all')
  const [spendFilter, setSpendFilter] = useState<Range>('all')
  const [skillsFilter, setSkillsFilter] = useState<Range>('all')
  const [assignmentsFilter, setAssignmentsFilter] = useState<Range>('all')

  // --- Progress trend ---
  const progressData = useMemo(
    () => buildProgressTrend(
      profile.completedLessonDates ?? [],
      profile.totalLessonsAll ?? 0,
      progressFilter,
    ),
    [profile.completedLessonDates, profile.totalLessonsAll, progressFilter],
  )

  // --- Spend trend ---
  const spendData = useMemo(
    () => buildSpendTrend(profile.rawOrders ?? [], spendFilter),
    [profile.rawOrders, spendFilter],
  )

  // --- Assignments filtered by dueDate ---
  const filteredAssignments = useMemo(() => {
    if (assignmentsFilter === 'all') return profile.assignments
    const days = parseInt(assignmentsFilter)
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return profile.assignments.filter((a) => {
      if (!a.dueDate) return true
      // dueDate comes from formatJoinedAt which returns Arabic relative text.
      // We store the ISO in the raw action, so we'll fall back to all if unparseable.
      const parsed = new Date(a.dueDate)
      return isNaN(parsed.getTime()) || parsed >= cutoff
    })
  }, [profile.assignments, assignmentsFilter])

  const assignmentBreakdown = useMemo(() => {
    const submitted = filteredAssignments.filter((a) => a.status === 'تم التسليم').length
    const late = filteredAssignments.filter((a) => a.status === 'متأخر').length
    const missing = filteredAssignments.filter((a) => a.status === 'لم يسلّم').length
    return [
      { label: 'تم التسليم', value: submitted },
      { label: 'متأخر', value: late },
      { label: 'لم يسلّم', value: missing },
    ].filter((b) => b.value > 0)
  }, [filteredAssignments])

  const progressSubtitle =
    progressFilter === 'all'
      ? 'نسبة إتمام الدروس خلال آخر 6 أشهر'
      : progressFilter === '7'
        ? 'الدروس المنجزة يوم بيوم آخر أسبوع'
        : progressFilter === '14'
          ? 'الدروس المنجزة آخر 14 يوم'
          : 'الدروس المنجزة آخر 30 يوم'

  const spendSubtitle =
    spendFilter === 'all'
      ? 'إجمالي المدفوعات خلال آخر 6 أشهر'
      : `إجمالي الإنفاق آخر ${spendFilter} يوم`

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* ── Progress Trend ── */}
      <ChartCard
        title="تطور التعلم"
        subtitle={progressSubtitle}
        filter={progressFilter}
        onFilterChange={setProgressFilter}
      >
        {progressData.every((p) => p.progress === 0) ? (
          <EmptyState text="لا توجد دروس مكتملة في هذه الفترة" />
        ) : (
          <ChartContainer config={progressConfig} className="aspect-[16/7] w-full">
            <AreaChart data={progressData} margin={{ left: -24, right: 12, top: 8 }}>
              <defs>
                <linearGradient id="fillProgress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-progress)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-progress)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} reversed />
              <YAxis tickLine={false} axisLine={false} width={36} domain={[0, 100]} orientation="right" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="progress"
                type="monotone"
                stroke="var(--color-progress)"
                strokeWidth={2}
                fill="url(#fillProgress)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </ChartCard>

      {/* ── Monthly Spend ── */}
      <ChartCard
        title="الإنفاق الشهري"
        subtitle={spendSubtitle}
        filter={spendFilter}
        onFilterChange={setSpendFilter}
        allLabel="آخر 6 شهور"
      >
        {spendData.every((s) => s.amount === 0) ? (
          <EmptyState text="لا توجد مدفوعات في هذه الفترة" />
        ) : (
          <ChartContainer config={spendConfig} className="aspect-[16/7] w-full">
            <BarChart data={spendData} margin={{ left: -24, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} reversed />
              <YAxis tickLine={false} axisLine={false} width={36} orientation="right" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </ChartCard>

      {/* ── Skills Radar ── */}
      <ChartCard
        title="المقارنة بين فروع المادة"
        subtitle={
          profile.stageTitle
            ? `أداء الطالب عبر فروع ${profile.stageTitle}`
            : 'أداء الطالب عبر فروع السنة الدراسية'
        }
        filter={skillsFilter}
        onFilterChange={setSkillsFilter}
      >
        {profile.skills.length > 0 ? (
          <>
            <ChartContainer config={skillsConfig} className="mx-auto aspect-[4/3] w-full max-h-[300px]">
              <RadarChart data={profile.skills}>
                <ChartTooltip content={<ChartTooltipContent />} />
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <Radar
                  dataKey="examAvg"
                  fill="var(--color-examAvg)"
                  fillOpacity={0.35}
                  stroke="var(--color-examAvg)"
                  strokeWidth={2}
                />
                <Radar
                  dataKey="courseProgress"
                  fill="var(--color-courseProgress)"
                  fillOpacity={0.2}
                  stroke="var(--color-courseProgress)"
                  strokeWidth={2}
                />
              </RadarChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: 'var(--chart-1)' }} />
                متوسط الامتحانات
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: 'var(--chart-2)' }} />
                تقدّم المحاضرات
              </span>
            </div>
          </>
        ) : (
          <EmptyState text="لا توجد فروع مرتبطة بالسنة الدراسية لهذا الطالب بعد." />
        )}
      </ChartCard>

      {/* ── Assignment Breakdown ── */}
      <ChartCard
        title="حالة الواجبات"
        subtitle={
          assignmentsFilter === 'all'
            ? 'توزيع الواجبات المسلّمة والمتأخرة'
            : `حالة الواجبات خلال آخر ${assignmentsFilter} يوم`
        }
        filter={assignmentsFilter}
        onFilterChange={setAssignmentsFilter}
      >
        {assignmentBreakdown.length > 0 ? (
          <>
            <ChartContainer config={breakdownConfig} className="mx-auto aspect-square max-h-[260px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="label" />} />
                <Pie
                  data={assignmentBreakdown}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={55}
                  strokeWidth={4}
                >
                  {assignmentBreakdown.map((entry, i) => (
                    <Cell key={entry.label} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
              {assignmentBreakdown.map((entry, i) => (
                <span key={entry.label} className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="size-2.5 rounded-[3px]"
                    style={{ backgroundColor: pieColors[i % pieColors.length] }}
                  />
                  {entry.label}: <strong className="text-foreground">{entry.value}</strong>
                </span>
              ))}
            </div>
          </>
        ) : (
          <EmptyState text="لا توجد واجبات في هذه الفترة." />
        )}
      </ChartCard>
    </div>
  )
}
