'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from './panel-card'
import { useState } from 'react'
import { DAILY_RANGE_OPTIONS } from '@/lib/time-series'

const config = {
  value: { label: 'النشاط', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function ActivityChart({ data = [] }: { data?: any[] }) {
  const [range, setRange] = useState('7')
  const chartData = data.slice(-Number(range))

  return (
    <PanelCard
      title="نشاط المنصة"
      filterOptions={DAILY_RANGE_OPTIONS}
      filterValue={range}
      onFilterChange={setRange}
    >
      <ChartContainer config={config} className="h-full min-h-[240px] w-full">
        <BarChart data={chartData} margin={{ left: -24, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            reversed
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            orientation="right"
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={[6, 6, 0, 0]}
            isAnimationActive animationDuration={700} animationEasing="ease-out"
          />
        </BarChart>
      </ChartContainer>
    </PanelCard>
  )
}
