'use client'

import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from '@/components/dashboard/panel-card'
import { studentsGrowth as initialData } from '@/lib/reports-data'
import { RANGE_OPTIONS } from '@/lib/time-series'

const config = {
  students: { label: 'إجمالي الطلاب', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function StudentsGrowthChart({ data: inputData }: { data?: any[] }) {
  const full = inputData || initialData
  const [range, setRange] = useState('6')
  const studentsGrowth = full.slice(-Number(range))
  return (
    <PanelCard
      title="نمو إجمالي الطلاب"
      filterOptions={RANGE_OPTIONS}
      filterValue={range}
      onFilterChange={setRange}
    >
      <ChartContainer config={config} className="h-[260px] w-full">
        <AreaChart data={studentsGrowth} margin={{ left: -24, right: 12, top: 8 }}>
          <defs>
            <linearGradient id="fillReportStudents" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-students)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-students)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} reversed />
          <YAxis tickLine={false} axisLine={false} width={44} orientation="right" tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : v)} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => [`${Number(value).toLocaleString('en')} طالب`, '']}
              />
            }
          />
          <Area
            dataKey="students"
            type="monotone"
            stroke="var(--color-students)"
            strokeWidth={2.5}
            fill="url(#fillReportStudents)"
            isAnimationActive animationDuration={700} animationEasing="ease-out"
          />
        </AreaChart>
      </ChartContainer>
    </PanelCard>
  )
}
