'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from '@/components/dashboard/panel-card'

const config = {
  revenue: { label: 'الإيراد', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function RevenueByCategoryChart({
  data,
}: {
  data: { name: string; revenue: number; fill: string }[]
}) {
  return (
    <PanelCard title="الإيرادات حسب التصنيف">
      {data.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          لا توجد إيرادات بعد.
        </div>
      ) : (
        <ChartContainer config={config} className="h-[240px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="name"
                  formatter={(value) => [`${Number(value).toLocaleString('en')} ج.م`, '']}
                />
              }
            />
            <Bar dataKey="revenue" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out">
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </PanelCard>
  )
}
