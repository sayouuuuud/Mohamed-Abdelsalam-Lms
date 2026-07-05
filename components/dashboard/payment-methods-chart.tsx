'use client'

import { Cell, Label, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from './panel-card'

const config = {
  value: { label: 'الإيراد' },
} satisfies ChartConfig

export function PaymentMethodsChart({
  data,
}: {
  data?: { method: string; value: number; fill: string }[]
}) {
  const rows = data || []
  const total = rows.reduce((s, r) => s + r.value, 0)

  return (
    <PanelCard title="الإيراد حسب طريقة الدفع">
      {total === 0 ? (
        <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          لا توجد مدفوعات مقبولة بعد
        </div>
      ) : (
        <div className="flex h-full flex-col items-center gap-4 sm:flex-row">
          <ChartContainer
            config={config}
            className="aspect-square min-h-[200px] w-full max-w-[220px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => [`${Number(value).toLocaleString()} ج.م`, ` ${name}`]}
                  />
                }
              />
              <Pie
                data={rows}
                dataKey="value"
                nameKey="method"
                innerRadius={55}
                strokeWidth={4}
                isAnimationActive={false}
              >
                {rows.map((r) => (
                  <Cell key={r.method} fill={r.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) - 4}
                            className="fill-foreground text-lg font-bold"
                          >
                            {(total / 1000).toFixed(0)}K
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 16}
                            className="fill-muted-foreground text-xs"
                          >
                            إجمالي
                          </tspan>
                        </text>
                      )
                    }
                    return null
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="flex w-full flex-col gap-2">
            {rows.map((r) => (
              <li key={r.method} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: r.fill }} />
                  <span className="text-muted-foreground">{r.method}</span>
                </div>
                <span className="font-semibold text-foreground">
                  {r.value.toLocaleString()} ج.م
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelCard>
  )
}
