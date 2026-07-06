// Shared helpers for building real, rolling monthly time-series used by the
// dashboard and reports charts. Buckets are keyed by `YYYY-MM` so payments and
// signups land in the correct calendar month instead of a hardcoded Jan–Jun.

export const AR_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

export type MonthBucket = { key: string; month: string; start: Date }

// Shared options for the chart time-range dropdowns. Values are month counts
// the chart slices from a 12-month series.
export const RANGE_OPTIONS = [
  { label: 'آخر 3 أشهر', value: '3' },
  { label: 'آخر 6 أشهر', value: '6' },
  { label: 'آخر 12 شهر', value: '12' },
]

export const DAILY_RANGE_OPTIONS = [
  { label: 'آخر 7 أيام', value: '7' },
  { label: 'آخر 14 يوم', value: '14' },
  { label: 'آخر 30 يوم', value: '30' },
]

export const AR_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
]

export type DayBucket = { key: string; day: string; start: Date }

export function lastDays(count: number): DayBucket[] {
  const now = new Date()
  const arr: DayBucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    arr.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      day: `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`,
      start: d,
    })
  }
  return arr
}

export function dayKeyOf(iso: string | Date): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getRangeStartDate(range: string): Date {
  const now = new Date()
  switch (range) {
    case '7d':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    case '30d':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    case '3m':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    case '6m':
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    case '12m':
      return new Date(now.getFullYear(), now.getMonth() - 12, now.getDate())
    case 'all':
    default:
      return new Date(2000, 0, 1)
  }
}

// Returns the last `count` months (oldest → newest), ending with the current
// month. Each bucket carries an Arabic label and a `YYYY-MM` key.
export function lastMonths(count: number): MonthBucket[] {
  const now = new Date()
  const arr: MonthBucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    arr.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      month: AR_MONTHS[d.getMonth()],
      start: d,
    })
  }
  return arr
}

// Normalizes an ISO timestamp (or Date) into a `YYYY-MM` bucket key.
export function monthKeyOf(iso: string | Date): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Period-over-period percentage change, rounded to 1 decimal. Returns 0 when the
// previous value is 0 and there's no current value, and 100 when growing from 0.
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}
