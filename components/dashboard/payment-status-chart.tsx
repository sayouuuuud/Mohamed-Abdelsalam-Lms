'use client'

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from './panel-card'

const config = {
  value: { label: 'المدفوعات' },
} satisfies ChartConfig

// Semantic colors: approved = green, pending = amber, rejected = red.
const STATUS_COLORS: Record<string, string> = {
  مقبول: 'var(--chart-2)',
  'قيد المراجعة': 'var(--chart-4)',
  مرفوض: 'var(--chart-5)',
}

export function PaymentStatusChart({
  data,
}: {
  data?: { name: string; value: number }[]
}) {
  const rows = data || []
  const total = rows.reduce((s, r) => s + r.value, 0)

  return (
    <PanelCard title="حالة المدفوعات">
      {total === 0 ? (
        <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          لا توجد مدفوعات بعد
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
              tick={{ fontSize: 12 }}
            />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(value) => [`${value} عملية`, '']} />}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out">
              {rows.map((r) => (
                <Cell key={r.name} fill={STATUS_COLORS[r.name] || 'var(--chart-1)'} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </PanelCard>
  )
}
