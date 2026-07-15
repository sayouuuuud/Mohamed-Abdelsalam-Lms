'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell,
  MessageSquare,
  Moon,
  Sun,
  Search,
  Menu,
  ChevronDown,
  Check,
  Settings,
  LogOut,
  User,
  ArrowLeft,
  Globe,
} from 'lucide-react'
import useSWR from 'swr'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useLogout } from '@/lib/use-logout'
import { getAdminProfile } from '@/app/admin/settings/actions'
import { toast } from 'sonner'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '@/app/admin/notifications/actions'
import type { NotificationRecord } from '@/lib/notifications-data'

/* ─── mock data ─── */
const mockMessages = [
  { id: 1, name: 'أحمد علي', text: 'متى موعد المحاضرة القادمة؟', time: 'منذ 5 د', read: false },
  { id: 2, name: 'سارة محمد', text: 'شكراً على الكورس، استفدت كتير', time: 'منذ 20 د', read: false },
  { id: 3, name: 'عمر خالد', text: 'هل يوجد تمارين إضافية؟', time: 'منذ ساعة', read: false },
  { id: 4, name: 'منى حسن', text: 'الفيديو مش بيشتغل عندي', time: 'منذ 3 س', read: true },
  { id: 5, name: 'يوسف إبراهيم', text: 'تم الاشتراك في الكورس الجديد', time: 'أمس', read: true },
]

/* ─── hook: close on outside click ─── */
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, cb])
}

/* ─── Messages dropdown ─── */
function MessagesDropdown() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(mockMessages)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false))

  const unread = messages.filter((m) => !m.read).length

  const markAllRead = () => setMessages((prev) => prev.map((m) => ({ ...m, read: true })))

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="relative text-muted-foreground hover:text-foreground"
        aria-label="الرسائل"
        aria-expanded={open}
      >
        <MessageSquare className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          {/* header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-bold text-foreground">الرسائل</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Check className="size-3" />
                  تعيين الكل كمقروء
                </button>
              )}
            </div>
          </div>

          {/* list */}
          <ul className="max-h-72 overflow-y-auto scrollbar-hide divide-y divide-border">
            {messages.map((msg) => (
              <li key={msg.id}>
                <button
                  onClick={() => {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m)),
                    )
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-right transition-colors hover:bg-secondary/60',
                    !msg.read && 'bg-primary/5',
                  )}
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                      {msg.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{msg.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{msg.time}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{msg.text}</p>
                  </div>
                  {!msg.read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              </li>
            ))}
          </ul>

          {/* footer */}
          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/admin/messages"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              عرض كل الرسائل
              <ArrowLeft className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Notifications dropdown ─── */
function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const knownIds = useRef<Set<string>>(new Set())
  const firstLoad = useRef(true)
  useOutsideClick(ref, () => setOpen(false))

  // Fetch real notifications on mount and poll periodically. Toast when a new
  // unread notification arrives (but not on the very first load).
  useEffect(() => {
    let active = true
    async function load() {
      const data = await getNotifications()
      if (!active) return
      if (!firstLoad.current) {
        const fresh = data.filter(
          (n) => !n.read && !knownIds.current.has(n.id),
        )
        for (const n of fresh.slice(0, 3)) {
          toast(n.title, { description: n.description || undefined })
        }
      }
      knownIds.current = new Set(data.map((n) => n.id))
      firstLoad.current = false
      setNotifications(data)
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const unread = notifications.filter((n) => !n.read).length
  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    markAllAsRead()
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="relative text-muted-foreground hover:text-foreground"
        aria-label="الإشعارات"
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          {/* header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-bold text-foreground">
              الإشعارات
              {unread > 0 && (
                <span className="mr-2 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-white">
                  {unread}
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Check className="size-3" />
                تعيين الكل كمقروء
              </button>
            )}
          </div>

          {/* list */}
          <ul className="max-h-72 overflow-y-auto scrollbar-hide divide-y divide-border">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                لا توجد إشعارات.
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      setNotifications((prev) =>
                        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
                      )
                      if (!n.read) markAsRead(n.id)
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-right transition-colors hover:bg-secondary/60',
                      !n.read && 'bg-primary/5',
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 size-2 shrink-0 rounded-full',
                        !n.read ? 'bg-primary' : 'bg-transparent',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-foreground">{n.title}</p>
                      {n.description && (
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          {n.description}
                        </p>
                      )}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{n.time}</span>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>

          {/* footer */}
          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              عرض كل الإشعارات
              <ArrowLeft className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Profile dropdown ─── */
function ProfileDropdown({ isDark, onToggleTheme }: { isDark: boolean; onToggleTheme: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const logout = useLogout()
  useOutsideClick(ref, () => setOpen(false))

  const { data: admin } = useSWR('admin-profile', () => getAdminProfile())
  const displayName = admin?.fullName?.trim() || 'مدير المنصة'
  const roleLabel = admin?.role === 'admin' ? 'مدير المنصة' : admin?.role || 'مدير المنصة'
  const initials = (displayName || 'أ').trim().slice(0, 2)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-secondary/60"
        aria-expanded={open}
        aria-label="قائمة الحساب"
      >
        <Avatar className="size-10 ring-2 ring-primary/20">
          {admin?.avatarUrl && <AvatarImage src={admin.avatarUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-bold text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </div>
        <ChevronDown
          className={cn(
            'hidden size-4 text-muted-foreground transition-transform sm:block',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          {/* user info */}
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{admin?.email || 'admin@platform.com'}</p>
          </div>

          {/* menu items */}
          <div className="py-1.5">
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary/60"
            >
              <User className="size-4 text-muted-foreground" />
              الملف الشخصي
            </Link>
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary/60"
            >
              <Settings className="size-4 text-muted-foreground" />
              الإعدادات
            </Link>

          </div>

          <div className="border-t border-border py-1.5">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              تسجيل الخروج
            </button>
          </div>

        </div>
      )}
    </div>
  )
}

/* ─── Main Header ─── */
export function Header({
  onMenuClick,
  isDark,
  onToggleTheme,
}: {
  onMenuClick: () => void
  isDark: boolean
  onToggleTheme: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState('')

  // Sync search input with the URL when on the global search page.
  useEffect(() => {
    if (pathname.startsWith('/admin/search')) {
      setSearchValue(searchParams.get('q') || '')
    } else {
      setSearchValue('')
    }
  }, [pathname, searchParams])

  const handleSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return
      // Ignore while IME composition is in progress (CJK & Arabic).
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      const q = e.currentTarget.value.trim()
      if (!q) return
      router.push(`/admin/search?q=${encodeURIComponent(q)}`)
    },
    [router],
  )

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        {/* Profile */}
        <ProfileDropdown isDark={isDark} onToggleTheme={onToggleTheme} />

        {/* Icon actions */}
        <div className="flex items-center gap-1">
          <NotificationsDropdown />
          <MessagesDropdown />
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="text-muted-foreground hover:text-foreground"
            aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
          >
            {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </div>

        {/* Search */}
        <div className="relative mx-auto hidden w-full max-w-xl md:block">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="بحث شامل — طالب، محاضرة، كورس، اختبار... (Enter)"
            className="h-11 w-full rounded-xl border border-border bg-secondary/60 pr-10 pl-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
          />
        </div>

        {/* View site - visible on desktop */}
        <Button
          variant="ghost"
          size="icon"
          className="mr-auto hidden text-muted-foreground hover:text-foreground md:flex"
          aria-label="عرض الموقع"
          title="عرض الموقع"
          nativeButton={false}
          render={<Link href="/" target="_blank" />}
        >
          <Globe className="size-5" />
        </Button>

        {/* Menu toggle - only visible on mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="mr-auto text-foreground md:hidden"
        >
          <Menu className="size-6" />
          <span className="sr-only">فتح القائمة</span>
        </Button>
      </div>
    </header>
  )
}
