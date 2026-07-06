'use client'

import { DonutChart } from '@/components/ui/donut-chart'
import { PanelCard } from '@/components/dashboard/panel-card'
import { categoryDistribution as initialData } from '@/lib/reports-data'

const config = {
  البرمجة: { label: 'البرمجة', color: 'var(--chart-1)' },
  التصميم: { label: 'التصميم', color: 'var(--chart-2)' },
  التسويق: { label: 'التسويق', color: 'var(--chart-3)' },
  اللغات: { label: 'اللغات', color: 'var(--chart-4)' },
  الأعمال: { label: 'الأعمال', color: 'var(--chart-5)' },
}

export function CategoryDistributionChart({ data: inputData }: { data?: any[] }) {
  const categoryDistribution = inputData || initialData
  const total = categoryDistribution.reduce((sum, c) => sum + c.value, 0)

  return (
    <PanelCard title="توزيع الطلاب حسب التصنيف" filter="إجمالي">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-2">
        <div className="flex h-[200px] w-full max-w-[200px] items-center justify-center">
          <DonutChart 
            data={categoryDistribution.map((c: any) => ({ value: c.value, color: c.fill, label: c.name }))} 
            size={180} 
            strokeWidth={24} 
          />
        </div>

        <ul className="flex-1 space-y-2.5">
          {categoryDistribution.map((c) => (
            <li key={c.name} className="flex items-center gap-2.5">
              <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: c.fill }} />
              <span className="flex-1 text-sm text-foreground">{c.name}</span>
              <span className="text-sm font-semibold text-muted-foreground">
                {Math.round((c.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PanelCard>
  )
}
