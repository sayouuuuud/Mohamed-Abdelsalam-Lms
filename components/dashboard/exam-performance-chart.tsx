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
  avg: { label: 'متوسط الدرجة', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function ExamPerformanceChart({ data }: { data?: { name: string; avg: number }[] }) {
  const rows = data && data.length > 0 ? data : []

  return (
    <PanelCard title="متوسط درجات الامتحانات" filter="أعلى مشاركة">
      {rows.length === 0 ? (
        <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          لا توجد امتحانات بعد
        </div>
      ) : (
        <ChartContainer config={config} className="h-full min-h-[240px] w-full">
          <BarChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={36}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent formatter={(value) => [`${value}%`, ' متوسط الدرجة']} />
              }
            />
            <Bar
              dataKey="avg"
              fill="var(--color-avg)"
              radius={[6, 6, 0, 0]}
              isAnimationActive animationDuration={700} animationEasing="ease-out"
            />
          </BarChart>
        </ChartContainer>
      )}
    </PanelCard>
  )
}
