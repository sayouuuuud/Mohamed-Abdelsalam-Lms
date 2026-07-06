'use client'

import { useEffect } from 'react'
import { pingPresence } from '@/app/student/presence-actions'

const INTERVAL_MS = 60_000 // ping once a minute while the tab is visible

// Invisible component: keeps the current student's `last_seen_at` fresh so the
// admin can see who is online. Pings on mount, on an interval, and whenever the
// tab becomes visible again. Skips pinging while the tab is hidden to avoid
// marking a backgrounded user as active.
export function PresenceHeartbeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const beat = () => {
      if (document.visibilityState === 'visible') {
        pingPresence().catch(() => {})
      }
    }

    // Immediate ping on mount.
    beat()
    timer = setInterval(beat, INTERVAL_MS)

    // Ping right away when the user returns to the tab.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
