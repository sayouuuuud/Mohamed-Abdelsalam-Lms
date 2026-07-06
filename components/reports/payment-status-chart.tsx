'use client'

import { DonutChart } from '@/components/ui/donut-chart'
import { PanelCard } from '@/components/dashboard/panel-card'

const config = {
  مقبول: { label: 'مقبول', color: 'var(--chart-1)' },
  'قيد المراجعة': { label: 'قيد المراجعة', color: 'var(--chart-4)' },
  مرفوض: { label: 'مرفوض', color: 'var(--chart-3)' },
}

export function PaymentStatusChart({ data }: { data: { name: string; value: number; fill: string }[] }) {
  const total = data.reduce((sum, s) => sum + s.value, 0)

  return (
    <PanelCard title="توزيع حالة المدفوعات">
      {total === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          لا توجد مدفوعات بعد.
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-2">
          <div className="flex h-[200px] w-full max-w-[200px] items-center justify-center">
            <DonutChart 
              data={data.map(d => ({ value: d.value, color: d.fill, label: d.name }))} 
              size={180} 
              strokeWidth={24} 
            />
          </div>

          <ul className="flex-1 space-y-2.5">
            {data.map((s) => (
              <li key={s.name} className="flex items-center gap-2.5">
                <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: s.fill }} />
                <span className="flex-1 text-sm text-foreground">{s.name}</span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {s.value} ({Math.round((s.value / total) * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelCard>
  )
}
