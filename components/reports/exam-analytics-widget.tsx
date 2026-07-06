'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from '@/components/dashboard/panel-card'
import { Card } from '@/components/ui/card'
import { CheckCircle2, XCircle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type ScoreRange = { range: string; count: number; fill: string }

const barConfig = {
  count: { label: 'عدد الطلاب', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function ExamAnalyticsWidget({
  avg,
  passed,
  failed,
  scoreRanges,
}: {
  avg?: number
  passed?: number
  failed?: number
  scoreRanges?: ScoreRange[]
}) {
  const total = (passed || 0) + (failed || 0)
  const passRate = total > 0 ? Math.round(((passed || 0) / total) * 100) : 0
  const ranges = scoreRanges || []

  const kpis = [
    {
      label: 'متوسط الدرجات',
      value: `${avg ?? 0}%`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'نسبة النجاح',
      value: `${passRate}%`,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'الرسوب',
      value: `${100 - passRate}%`,
      icon: XCircle,
      color: 'text-rose-600',
      bg: 'bg-rose-50 dark:bg-rose-500/10',
    },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* KPI cards */}
      <div className="flex flex-col gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="flex items-center gap-4 p-5">
            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', k.bg)}>
              <k.icon className={cn('size-5', k.color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-xl font-bold text-foreground">{k.value}</p>
              <p className="text-xs text-muted-foreground">من {total.toLocaleString('en')} امتحان</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Score distribution bar chart */}
      <div className="lg:col-span-2">
        <PanelCard title="توزيع الدرجات">
          {ranges.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد نتائج امتحانات بعد.</p>
          ) : (
            <ChartContainer config={barConfig} className="h-[240px] w-full">
              <BarChart data={ranges} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="range" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`${value} طالب`, 'عدد الطلاب']}
                    />
                  }
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {ranges.map((r, i) => (
                    <rect key={i} fill={r.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </PanelCard>
      </div>
    </div>
  )
}
