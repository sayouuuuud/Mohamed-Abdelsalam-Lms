'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from '@/components/dashboard/panel-card'
import type { ActivityDay } from '@/lib/student-types'
import { getStudentLearningActivity } from '@/app/student/actions'

const config = {
  hours: { label: 'ساعات', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function LearningActivityChart({ activity: initialActivity = [] }: { activity?: ActivityDay[] }) {
  const [days, setDays] = useState('7')

  const { data: activity } = useSWR(
    ['student-activity', days],
    () => getStudentLearningActivity(Number(days)),
    { fallbackData: days === '7' ? initialActivity : undefined }
  )

  const chartData = activity || initialActivity

  return (
    <PanelCard
      title="نشاط التعلّم"
      filterOptions={[
        { label: 'آخر 7 أيام', value: '7' },
        { label: 'آخر 14 يوم', value: '14' },
        { label: 'آخر 30 يوم', value: '30' },
      ]}
      filterValue={days}
      onFilterChange={setDays}
    >
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <AreaChart data={chartData} margin={{ left: -24, right: 12, top: 8 }}>
          <defs>
            <linearGradient id="fillHours" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-hours)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-hours)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} reversed />
          <YAxis tickLine={false} axisLine={false} width={28} orientation="right" />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Area
            dataKey="hours"
            type="monotone"
            stroke="var(--color-hours)"
            strokeWidth={2}
            fill="url(#fillHours)"
            isAnimationActive animationDuration={700} animationEasing="ease-out"
          />
        </AreaChart>
      </ChartContainer>
    </PanelCard>
  )
}
