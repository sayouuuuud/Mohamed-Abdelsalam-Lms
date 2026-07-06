'use client'

import { DonutChart } from '@/components/ui/donut-chart'
import { PanelCard } from './panel-card'

const config = {
  value: { label: 'الإيراد' },
}

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
          <div className="flex aspect-square min-h-[200px] w-full max-w-[220px] items-center justify-center">
            <DonutChart
              data={rows.map((r: any) => ({ value: r.value, color: r.fill, label: r.method }))}
              size={180}
              strokeWidth={24}
              centerContent={
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="fill-foreground text-lg font-bold">
                    {new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(total)}
                  </span>
                  <span className="fill-muted-foreground text-xs">
                    إجمالي
                  </span>
                </div>
              }
            />
          </div>
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
