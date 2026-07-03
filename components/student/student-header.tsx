'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
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
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useStudent } from '@/components/student/student-context'
import { getStudentAvatar } from '@/lib/students-data'
import { useLogout } from '@/lib/use-logout'
import { CartButton } from '@/components/cart/cart-button'
import {
  getStudentNotifications,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
} from '@/app/student/actions'

type HeaderNotif = {
  id: string
  notifId?: string
  text: string
  title?: string
  time: string
  read: boolean
}

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, cb])
}

function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<HeaderNotif[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const knownIds = useRef<Set<string>>(new Set())
  const firstLoad = useRef(true)
  useOutsideClick(ref, () => setOpen(false))

  // Fetch real notifications on mount and poll periodically. Toast when a new
  // unread notification arrives (but not on the very first load).
  useEffect(() => {
    let active = true
    async function load() {
      const data = (await getStudentNotifications()) as HeaderNotif[]
      if (!active) return
      if (!firstLoad.current) {
        const fresh = data.filter(
          (n) => !n.read && n.notifId && !knownIds.current.has(n.notifId),
        )
        for (const n of fresh.slice(0, 3)) {
          toast(n.title || n.text, { description: n.title ? n.text : undefined })
        }
      }
      knownIds.current = new Set(data.map((n) => n.notifId).filter(Boolean) as string[])
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
    const ids = notifications.filter((n) => !n.read && n.notifId).map((n) => n.notifId!)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (ids.length) markAllStudentNotificationsRead(ids)
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

          <ul className="max-h-72 divide-y divide-border overflow-y-auto scrollbar-hide">
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
                        prev.map((item) =>
                          item.id === n.id ? { ...item, read: true } : item,
                        ),
                      )
                      if (n.notifId) markStudentNotificationRead(n.notifId)
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
                      {n.title && (
                        <p className="text-sm font-semibold leading-snug text-foreground">
                          {n.title}
                        </p>
                      )}
                      <p className="text-sm leading-snug text-muted-foreground">{n.text}</p>
                      <span className="mt-0.5 text-[11px] text-muted-foreground">
                        {n.time}
                      </span>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/student/notifications"
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

function ProfileDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const logout = useLogout()
  useOutsideClick(ref, () => setOpen(false))
  const { profile } = useStudent()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-secondary/60"
        aria-expanded={open}
        aria-label="قائمة الحساب"
      >
        <Avatar className="size-10 ring-2 ring-primary/20">
          <AvatarImage
            src={getStudentAvatar(profile as any)}
            alt={profile.name}
          />
          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
            {profile.initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-bold text-foreground">{profile.name}</p>
          <p className="text-xs text-muted-foreground">{profile.level}</p>
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
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-foreground">{profile.name}</p>
            <p className="text-xs text-muted-foreground">{profile.email}</p>
          </div>

          <div className="py-1.5">
            <Link
              href="/student/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary/60"
            >
              <User className="size-4 text-muted-foreground" />
              الملف الشخصي
            </Link>
            <Link
              href="/student/settings"
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

export function StudentHeader({
  onMenuClick,
  isDark,
  onToggleTheme,
}: {
  onMenuClick: () => void
  isDark: boolean
  onToggleTheme: () => void
}) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <ProfileDropdown />

        <div className="flex items-center gap-1">
          <CartButton className="text-muted-foreground hover:text-foreground" />
          <NotificationsDropdown />
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

        <div className="relative mx-auto hidden w-full max-w-xl md:block">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="ابحث عن كورس، درس، اختبار..."
            className="h-11 w-full rounded-xl border border-border bg-secondary/60 pr-10 pl-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
          />
        </div>

        {/* Back - visible on desktop */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="mr-auto hidden text-muted-foreground hover:text-foreground md:flex"
          aria-label="رجوع"
          title="رجوع"
        >
          <ArrowLeft className="size-5" />
        </Button>

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
