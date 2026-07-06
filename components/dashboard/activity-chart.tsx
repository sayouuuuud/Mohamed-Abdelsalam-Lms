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
  value: { label: 'النشاط', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function ActivityChart({ data = [] }: { data?: any[] }) {
  return (
    <PanelCard title="نشاط المنصة">
      <ChartContainer config={config} className="h-full min-h-[240px] w-full">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={[6, 6, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </PanelCard>
  )
}
