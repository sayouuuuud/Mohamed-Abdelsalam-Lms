// Shared permission constants and helpers.
// SAFE for client, server, and middleware (no server-only imports, no icons).

export type AccessLevel = 'none' | 'view' | 'manage'

export type ResourceKey =
  | 'dashboard'
  | 'students'
  | 'categories'
  | 'courses'
  | 'exams'
  | 'calendar'
  | 'payments'
  | 'messages'
  | 'notifications'
  | 'coupons'
  | 'reports'
  | 'settings'

export type PermissionMap = Record<ResourceKey, AccessLevel>

/** Canonical resource list — mirrors the admin sidebar order. */
export const RESOURCES: { key: ResourceKey; label: string; href: string }[] = [
  { key: 'dashboard', label: 'الصفحة الرئيسية', href: '/admin/dashboard' },
  { key: 'students', label: 'الطلاب', href: '/admin/students' },
  { key: 'categories', label: 'التصنيفات', href: '/admin/categories' },
  { key: 'courses', label: 'المحاضرات', href: '/admin/courses' },
  { key: 'exams', label: 'الاختبارات', href: '/admin/exams' },
  { key: 'calendar', label: 'التقويم', href: '/admin/calendar' },
  { key: 'payments', label: 'الطلبات', href: '/admin/payments' },
  { key: 'messages', label: 'الرسائل', href: '/admin/messages' },
  { key: 'notifications', label: 'الإشعارات', href: '/admin/notifications' },
  { key: 'coupons', label: 'خصومات و الكوبونات', href: '/admin/coupons' },
  { key: 'reports', label: 'التقارير', href: '/admin/reports' },
  { key: 'settings', label: 'الإعدادات', href: '/admin/settings' },
]

export const RESOURCE_KEYS: ResourceKey[] = RESOURCES.map((r) => r.key)

/** All-permissions map at a given level (used for admin = manage everywhere). */
export function fullPermissionMap(level: AccessLevel): PermissionMap {
  return RESOURCE_KEYS.reduce((acc, key) => {
    acc[key] = level
    return acc
  }, {} as PermissionMap)
}

/** Map an /admin/* pathname to its owning resource key (null if not an admin route). */
export function mapPathToResource(pathname: string): ResourceKey | null {
  if (!pathname.startsWith('/admin')) return null
  // /admin/courses/123/lessons/... -> segment after /admin
  const rest = pathname.slice('/admin'.length).replace(/^\/+/, '')
  const seg = rest.split('/')[0] || 'dashboard'
  const match = RESOURCE_KEYS.find((k) => k === seg)
  return match ?? null
}

/** Does an access level satisfy a required level? */
export function satisfies(level: AccessLevel, required: AccessLevel): boolean {
  if (required === 'view') return level === 'view' || level === 'manage'
  if (required === 'manage') return level === 'manage'
  return true // required === 'none'
}
