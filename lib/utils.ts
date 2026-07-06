import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRelativeTimeArabic(dateInput: string | Date) {
  const date = new Date(dateInput)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.round(diffMs / 1000)
  const diffMinutes = Math.round(diffSeconds / 60)
  const diffHours = Math.round(diffMinutes / 60)
  const diffDays = Math.round(diffHours / 24)
  const diffMonths = Math.round(diffDays / 30)
  const diffYears = Math.round(diffDays / 365)

  const rtf = new Intl.RelativeTimeFormat('ar-EG', { numeric: 'auto' })

  if (diffSeconds < 60) return 'الآن'
  if (diffMinutes < 60) return rtf.format(-diffMinutes, 'minute')
  if (diffHours < 24) return rtf.format(-diffHours, 'hour')
  if (diffDays < 30) return rtf.format(-diffDays, 'day')
  if (diffMonths < 12) return rtf.format(-diffMonths, 'month')
  return rtf.format(-diffYears, 'year')
}
