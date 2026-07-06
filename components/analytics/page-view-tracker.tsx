'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

// Fires a single tracking beacon whenever the pathname changes.
// Admin and API paths are ignored both here and server-side as a safety net.
export function PageViewTracker() {
  const pathname = usePathname()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return
    // Guard against duplicate sends for the same path (e.g. re-renders).
    if (lastTracked.current === pathname) return
    lastTracked.current = pathname

    const controller = new AbortController()
    // Fire-and-forget; failures must never affect the page.
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {})

    return () => controller.abort()
  }, [pathname])

  return null
}
