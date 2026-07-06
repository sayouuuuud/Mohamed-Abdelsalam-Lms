'use client'

import { useRouter, useSearchParams } from 'next/navigation'

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

  const handleValueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', val)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        الفترة الزمنية:
      </span>
      <select
        value={currentRange}
        onChange={handleValueChange}
        className="flex h-9 w-[140px] items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {GLOBAL_RANGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
