'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme-provider'
import { CartButton } from '@/components/cart/cart-button'
import { useCart } from '@/components/cart/cart-provider'
import type { NavbarContent } from '@/lib/site-content-defaults'
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content-defaults'

function ThemeToggle({ className }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      className={cn(
        'grid size-10 place-items-center rounded-full border border-navy/15 text-navy transition-colors hover:bg-navy/5',
        'dark:border-white/10 dark:text-teal-glow dark:hover:bg-white/5',
        className,
      )}
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}

export function LandingNavbar({
  isLoggedIn = false,
  content = DEFAULT_SITE_CONTENT.navbar,
}: {
  isLoggedIn?: boolean
  content?: NavbarContent
}) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { loggedIn: cartLoggedIn } = useCart()

  const isUserLoggedIn = isLoggedIn || cartLoggedIn

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 md:pt-4">
      <nav
        className={cn(
          'mx-auto flex h-14 max-w-[88rem] items-center justify-between rounded-full px-3 pr-5 transition-all duration-300 md:h-16 md:pr-6',
          'border border-navy/15 bg-cream/50 shadow-lg shadow-navy/5 ring-1 ring-cream/40 backdrop-blur-xl backdrop-saturate-150',
          'dark:border-white/10 dark:bg-ink-raised/50 dark:shadow-black/30 dark:ring-white/5',
          scrolled
            ? 'bg-cream/70 shadow-xl shadow-navy/10 dark:bg-ink-raised/70 dark:shadow-black/40'
            : 'bg-cream/40 dark:bg-ink-raised/40',
        )}
      >
        <Link href="/" className="flex items-center gap-2.5">
          {content.logoUrl ? (
            <Image
              src={content.logoUrl}
              alt={content.siteName}
              width={36}
              height={36}
              className="size-9 rounded-md object-cover"
            />
          ) : (
            <span className="grid size-9 place-items-center rounded-md bg-navy font-mono text-sm font-bold text-cream dark:bg-teal-glow dark:text-ink-base dark:shadow-[0_0_18px_oklch(0.84_0.13_184_/_0.5)]">
              ƒ(x)
            </span>
          )}
          <span className="font-heading text-xl font-bold text-navy dark:text-ink-fg">{content.siteName}</span>
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {content.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group relative text-sm font-semibold text-navy-soft transition-colors hover:text-navy dark:text-ink-dim dark:hover:text-ink-fg"
            >
              {l.label}
              <span className="absolute -bottom-1.5 right-0 h-0.5 w-0 bg-gold transition-all duration-300 group-hover:w-full dark:bg-teal-glow" />
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <CartButton className="text-navy dark:text-ink-fg" />
          <ThemeToggle />
          {isUserLoggedIn ? (
            <Link
              href="/auth"
              className="inline-flex items-center rounded-full bg-navy px-6 py-2.5 text-sm font-bold text-cream transition-transform duration-200 hover:-translate-y-0.5 hover:bg-navy-deep dark:bg-violet-glow dark:text-white dark:hover:bg-violet-deep"
            >
              {content.ctaAccountText}
            </Link>
          ) : (
            <>
              <Link
                href="/auth"
                className="rounded-full px-5 py-2.5 text-sm font-bold text-navy transition-colors hover:bg-navy/5 dark:text-ink-fg dark:hover:bg-white/5"
              >
                {content.ctaLoginText}
              </Link>
              <Link
                href="/auth?mode=register"
                className="inline-flex items-center rounded-full bg-navy px-6 py-2.5 text-sm font-bold text-cream transition-transform duration-200 hover:-translate-y-0.5 hover:bg-navy-deep dark:bg-violet-glow dark:text-white dark:shadow-[0_0_22px_oklch(0.66_0.2_292_/_0.45)] dark:hover:bg-violet-deep"
              >
                {content.ctaRegisterText}
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <CartButton className="text-navy dark:text-ink-fg" />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-md text-navy dark:text-ink-fg"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="mx-auto mt-3 max-w-6xl rounded-3xl border border-cream/40 bg-cream/80 px-5 py-4 shadow-xl shadow-navy/10 backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-ink-raised/90 dark:shadow-black/40">
          <div className="flex flex-col gap-1">
            {content.links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-semibold text-navy-soft transition-colors hover:bg-navy/5 hover:text-navy dark:text-ink-dim dark:hover:bg-white/5 dark:hover:text-ink-fg"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              {isUserLoggedIn ? (
                <Link
                  href="/auth"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-full bg-navy px-6 py-3 text-center text-base font-bold text-cream dark:bg-violet-glow dark:text-white"
                >
                  {content.ctaAccountText}
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-full border border-navy/15 px-6 py-3 text-center text-base font-bold text-navy dark:border-white/10 dark:text-ink-fg"
                  >
                    {content.ctaLoginText}
                  </Link>
                  <Link
                    href="/auth?mode=register"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-full bg-navy px-6 py-3 text-center text-base font-bold text-cream dark:bg-violet-glow dark:text-white"
                  >
                    {content.ctaRegisterText}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
