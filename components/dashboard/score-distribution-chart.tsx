'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from './panel-card'

const config = {
  count: { label: 'عدد الطلاب', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function ScoreDistributionChart({
  data,
}: {
  data?: { range: string; count: number }[]
}) {
  const rows = data || []
  const total = rows.reduce((s, r) => s + r.count, 0)

  return (
    <PanelCard title="توزيع الدرجات">
      {total === 0 ? (
        <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          لا توجد تسليمات بعد
        </div>
      ) : (
        <ChartContainer config={config} className="h-full min-h-[240px] w-full">
          <BarChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="range"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(value) => [`${value} طالب`, '']} />}
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[6, 6, 0, 0]}
              isAnimationActive animationDuration={700} animationEasing="ease-out"
            />
          </BarChart>
        </ChartContainer>
      )}
    </PanelCard>
  )
}
