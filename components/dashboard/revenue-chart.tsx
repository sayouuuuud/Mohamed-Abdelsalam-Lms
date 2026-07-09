'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from './panel-card'
import { RANGE_OPTIONS } from '@/lib/time-series'

const config = {
  revenue: { label: 'الإيرادات', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function RevenueChart({ data = [] }: { data?: any[] }) {
  const [range, setRange] = useState('6')
  const chartData = data.slice(-Number(range))

  return (
    <PanelCard
      title="الإيرادات الشهرية"
      filterOptions={RANGE_OPTIONS}
      filterValue={range}
      onFilterChange={setRange}
    >
      <ChartContainer config={config} className="h-full min-h-[240px] w-full">
        <LineChart data={chartData} margin={{ left: -24, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            reversed
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            orientation="right"
            tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => [`${Number(value).toLocaleString('en')} ج.م`, '']}
              />
            }
          />
          <Line
            dataKey="revenue"
            type="monotone"
            stroke="var(--color-revenue)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--color-revenue)' }}
            activeDot={{ r: 6 }}
            isAnimationActive animationDuration={700} animationEasing="ease-out"
          />
        </LineChart>
      </ChartContainer>
    </PanelCard>
  )
}
