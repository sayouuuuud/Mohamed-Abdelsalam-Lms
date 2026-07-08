'use client'

import { DonutChart } from '@/components/ui/donut-chart'
import type { ChartConfig } from '@/components/ui/chart'
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
          <div className="flex mx-auto aspect-square min-h-[200px] w-full max-w-[240px] items-center justify-center">
            <DonutChart
              data={rows.map((r: any) => ({ value: r.value, color: `var(--color-${r.key})`, label: r.name }))}
              size={200}
              strokeWidth={24}
              centerContent={
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="fill-foreground text-2xl font-bold">
                    {total.toLocaleString()}
                  </span>
                  <span className="fill-muted-foreground text-xs">
                    تسليم
                  </span>
                </div>
              }
            />
          </div>
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
