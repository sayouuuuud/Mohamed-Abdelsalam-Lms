'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from '@/components/dashboard/panel-card'
import { monthlyRevenue as initialData } from '@/lib/reports-data'
import { RANGE_OPTIONS } from '@/lib/time-series'

const config = {
  revenue: { label: 'الإيرادات الفعلية', color: 'var(--chart-1)' },
  target: { label: 'المستهدف', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function RevenueReportChart({ data: inputData }: { data?: any[] }) {
  const full = inputData || initialData
  const [range, setRange] = useState('6')
  const monthlyRevenue = full.slice(-Number(range))
  return (
    <PanelCard
      title="الإيرادات مقابل المستهدف"
      filterOptions={RANGE_OPTIONS}
      filterValue={range}
      onFilterChange={setRange}
    >
      <div className="mb-4 text-xs text-muted-foreground">
        المستهدف يمثل الإيرادات المتوقعة للنمو (بنسبة 15% زيادة عن إيرادات الشهر السابق).
      </div>
      <ChartContainer config={config} className="h-[260px] w-full">
        <BarChart data={monthlyRevenue} margin={{ left: -24, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} reversed />
          <YAxis tickLine={false} axisLine={false} width={44} orientation="right" tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : v)} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => [
                  `${Number(value).toLocaleString('en')} ج.م`,
                  config[name as keyof typeof config]?.label ?? '',
                ]}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out" />
          <Bar dataKey="target" fill="var(--color-target)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out" />
        </BarChart>
      </ChartContainer>
    </PanelCard>
  )
}
