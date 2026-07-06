export type NotificationType =
  | 'طالب'
  | 'دفع'
  | 'اختبار'
  | 'كورس'
  | 'رسالة'
  | 'نظام'

export type NotificationRecord = {
  id: string
  type: NotificationType
  title: string
  description: string
  time: string
  read: boolean
}

export const notificationTypeFilters: {
  value: NotificationType | 'الكل'
  label: string
}[] = [
    { value: 'الكل', label: 'الكل' },
    { value: 'طالب', label: 'الطلاب' },
    { value: 'دفع', label: 'المدفوعات' },
    { value: 'اختبار', label: 'الاختبارات' },
    { value: 'كورس', label: 'المحاضرات' },
    { value: 'رسالة', label: 'الرسائل' },
    { value: 'نظام', label: 'النظام' },
  ]

// Builds a live Arabic relative-time label from an ISO timestamp, e.g.
// "الآن" / "منذ 5 دقائق" / "منذ ساعتين" / "أمس" / "منذ 3 أيام". Computed at read
// time so ordering by created_at always matches the displayed label.
export function formatRelativeArabic(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))

  if (diffSec < 60) return 'الآن'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    if (diffMin === 1) return 'منذ دقيقة'
    if (diffMin === 2) return 'منذ دقيقتين'
    if (diffMin <= 10) return `منذ ${diffMin} دقائق`
    return `منذ ${diffMin} دقيقة`
  }

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) {
    if (diffHr === 1) return 'منذ ساعة'
    if (diffHr === 2) return 'منذ ساعتين'
    if (diffHr <= 10) return `منذ ${diffHr} ساعات`
    return `منذ ${diffHr} ساعة`
  }

  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) return 'أمس'
  if (diffDay === 2) return 'منذ يومين'
  if (diffDay <= 10) return `منذ ${diffDay} أيام`
  if (diffDay < 30) return `منذ ${diffDay} يومًا`

  // Older than a month → show an absolute date.
  return new Date(iso).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
