'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from '@/components/dashboard/panel-card'
import type { ActivityDay } from '@/lib/student-types'

const config = {
  hours: { label: 'ساعات', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function LearningActivityChart({ activity = [] }: { activity?: ActivityDay[] }) {
  return (
    <PanelCard title="نشاط التعلّم الأسبوعي" filter="هذا الأسبوع">
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <AreaChart data={activity} margin={{ left: 4, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="fillHours" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-hours)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-hours)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={28} />
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
