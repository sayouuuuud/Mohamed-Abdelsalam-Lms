'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { recordLogout } from '@/app/auth/audit-actions'

export function useLogout() {
  const router = useRouter()

  return useCallback(async () => {
    await recordLogout().catch(() => {})
    await signOut({ callbackUrl: '/auth' })
  }, [])
}
