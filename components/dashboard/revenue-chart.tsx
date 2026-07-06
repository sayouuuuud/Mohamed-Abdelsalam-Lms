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
const config = {
  revenue: { label: 'الإيرادات', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function RevenueChart({ data = [] }: { data?: any[] }) {
  return (
    <PanelCard title="الإيرادات">
      <ChartContainer config={config} className="h-full min-h-[240px] w-full">
        <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => `${v / 1000}K`}
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
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </PanelCard>
  )
}
