'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  CalendarDays,
  ShoppingCart,
  MessageSquare,
  Bell,
  Tag,
  Layers,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/lib/use-logout'
import { NavBadge } from '@/components/nav-badge'
import {
  getAdminSidebarBadges,
  type AdminSidebarBadges,
} from '@/app/admin/badges-actions'
import type { PermissionMap, ResourceKey } from '@/lib/permissions'

type BadgeKey = keyof AdminSidebarBadges

const navItems: {
  label: string
  icon: typeof LayoutDashboard
  href: string
  resource: ResourceKey
  badge?: BadgeKey
  adminOnly?: boolean
}[] = [
  { label: 'الصفحة الرئيسية', icon: LayoutDashboard, href: '/admin/dashboard', resource: 'dashboard' },
  { label: 'الطلاب', icon: Users, href: '/admin/students', resource: 'students' },
  { label: 'التصنيفات', icon: Layers, href: '/admin/categories', resource: 'categories' },
  { label: 'المحاضرات', icon: BookOpen, href: '/admin/courses', resource: 'courses' },
  { label: 'الاختبارات', icon: ClipboardList, href: '/admin/exams', resource: 'exams' },
  { label: 'التقويم', icon: CalendarDays, href: '/admin/calendar', resource: 'calendar' },
  { label: 'الطلبات', icon: ShoppingCart, href: '/admin/payments', resource: 'payments', badge: 'orders' },
  { label: 'رسائل', icon: MessageSquare, href: '/admin/messages', resource: 'messages', badge: 'messages' },
  { label: 'الإشعارات', icon: Bell, href: '/admin/notifications', resource: 'notifications', badge: 'notifications' },
  { label: 'خصومات و الكوبونات', icon: Tag, href: '/admin/coupons', resource: 'coupons' },
  { label: 'التقارير', icon: BarChart3, href: '/admin/reports', resource: 'reports' },
  { label: 'سجل المراقبة', icon: ShieldCheck, href: '/admin/activity', resource: 'settings', adminOnly: true },
  { label: 'الإعدادات', icon: Settings, href: '/admin/settings', resource: 'settings' },
]

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
  permissions,
}: {
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  permissions?: PermissionMap
}) {
  const pathname = usePathname()
  // When a permission map is provided (assistant), hide adminOnly items and
  // items the user has no access to. Admins (permissions = undefined) see all.
  const visibleNavItems = permissions
    ? navItems.filter((item) => {
        if (item.adminOnly) return false
        const level = permissions[item.resource]
        return level === 'view' || level === 'manage'
      })
    : navItems
  const logout = useLogout()
  const [badges, setBadges] = useState<AdminSidebarBadges>({
    orders: 0,
    messages: 0,
    notifications: 0,
  })

  // Fetch live counts on mount, poll every 60s, and refresh on navigation
  // so a badge clears right after the admin visits the relevant page.
  useEffect(() => {
    let active = true
    async function load() {
      const data = await getAdminSidebarBadges()
      if (active) setBadges(data)
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [pathname])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full',
          collapsed ? 'w-[72px]' : 'w-72',
        )}
      >
        {/* Logo */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                <GraduationCap className="size-6" />
              </div>
              <div className="leading-tight">
                <h1 className="text-base font-bold text-white">منصة تعليمية</h1>
                <p className="text-xs text-sidebar-foreground/60">لوحة الإدارة</p>
              </div>
            </div>
          )}

          {/* Close on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-sidebar-foreground hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="size-5" />
            <span className="sr-only">إغلاق القائمة</span>
          </Button>

          {/* Collapse toggle on desktop */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="hidden text-sidebar-foreground hover:bg-white/10 hover:text-white md:flex"
            aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            {collapsed ? (
              <ChevronLeft className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col px-2 py-2">
          <div className="ns-stagger flex flex-1 flex-col justify-around">
          {visibleNavItems.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`)
            return (
              <div key={item.label} className="group relative">
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    collapsed ? 'justify-center' : '',
                    active
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/30'
                      : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-white hover:-translate-x-0.5',
                  )}
                >
                  <item.icon className="size-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  {collapsed && item.badge && (
                    <NavBadge count={badges[item.badge]} collapsed />
                  )}
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && badges[item.badge] > 0 ? (
                        <NavBadge count={badges[item.badge]} />
                      ) : (
                        active && <ChevronLeft className="size-4 opacity-70" />
                      )}
                    </>
                  )}
                </Link>

                {/* Tooltip on collapsed */}
                {collapsed && (
                  <div className="pointer-events-none absolute right-full top-1/2 z-50 me-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                    {item.label}
                    <span className="absolute right-[-4px] top-1/2 -translate-y-1/2 border-4 border-transparent border-l-foreground" />
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-sidebar-border px-2 py-2">
          <div className="group relative">
            <button
              type="button"
              onClick={logout}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-white/5 hover:text-white',
                collapsed && 'justify-center',
              )}
            >
              <LogOut className="size-5 shrink-0" />
              {!collapsed && <span>تسجيل الخروج</span>}
            </button>
            {collapsed && (
              <div className="pointer-events-none absolute right-full top-1/2 z-50 me-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                تسجيل الخروج
                <span className="absolute right-[-4px] top-1/2 -translate-y-1/2 border-4 border-transparent border-l-foreground" />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
