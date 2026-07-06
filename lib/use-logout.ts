'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recordLogout } from '@/app/auth/audit-actions'

/**
 * Returns a logout handler that signs the user out of Supabase
 * and sends them back to the auth page.
 */
export function useLogout() {
  const router = useRouter()

  return useCallback(async () => {
    const supabase = createClient()
    // Record logout before clearing the session (session is still valid here).
    await recordLogout().catch(() => {})
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }, [router])
}
