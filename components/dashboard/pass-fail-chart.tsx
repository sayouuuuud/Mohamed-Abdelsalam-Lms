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
  value: { label: 'التسليمات' },
  pass: { label: 'ناجح', color: 'var(--chart-2)' },
  fail: { label: 'راسب', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function PassFailChart({
  data,
}: {
  data?: { name: string; key: string; value: number }[]
}) {
  const rows = data || []
  const total = rows.reduce((s, r) => s + r.value, 0)

  return (
    <PanelCard title="النجاح والرسوب">
      {total === 0 ? (
        <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          لا توجد تسليمات بعد
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <ChartContainer config={config} className="mx-auto aspect-square min-h-[200px] w-full max-w-[240px]">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                strokeWidth={4}
                isAnimationActive={false}
              >
                {rows.map((r) => (
                  <Cell key={r.key} fill={`var(--color-${r.key})`} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-2xl font-bold"
                          >
                            {total.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 20}
                            className="fill-muted-foreground text-xs"
                          >
                            تسليم
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
          <div className="mt-2 flex justify-center gap-4">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-1.5 text-xs">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: `var(--color-${r.key})` }}
                />
                <span className="text-muted-foreground">{r.name}</span>
                <span className="font-semibold text-foreground">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelCard>
  )
}
