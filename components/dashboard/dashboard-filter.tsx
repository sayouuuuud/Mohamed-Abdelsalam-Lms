'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

export const GLOBAL_RANGE_OPTIONS = [
  { label: 'آخر 7 أيام', value: '7d' },
  { label: 'آخر 30 يوم', value: '30d' },
  { label: 'آخر 3 أشهر', value: '3m' },
  { label: 'آخر 6 أشهر', value: '6m' },
  { label: 'آخر 12 شهر', value: '12m' },
  { label: 'كل الوقت', value: 'all' },
]

export function DashboardFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentRange = searchParams.get('range') || '30d'

  const handleChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', val)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="dashboard-range"
        className="text-sm font-medium text-muted-foreground whitespace-nowrap"
      >
        الفترة الزمنية:
      </label>
      <div className="relative">
        <select
          id="dashboard-range"
          value={currentRange}
          onChange={(e) => handleChange(e.target.value)}
          className="h-9 w-[140px] appearance-none rounded-lg border border-border bg-card pe-8 ps-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {GLOBAL_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
