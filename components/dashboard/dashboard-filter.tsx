'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

  const handleValueChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', val)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        الفترة الزمنية:
      </span>
      <Select value={currentRange} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[140px] bg-card">
          <SelectValue placeholder="اختر الفترة" />
        </SelectTrigger>
        <SelectContent>
          {GLOBAL_RANGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
