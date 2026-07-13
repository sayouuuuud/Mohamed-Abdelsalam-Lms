import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { createClient } from '@/lib/supabase/server'
import { getPermissionMap, getCurrentRole } from '@/lib/auth-guard'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const role = await getCurrentRole(supabase)
  const permissions = role === 'admin' ? undefined : await getPermissionMap(supabase)

  return <DashboardLayout permissions={permissions}>{children}</DashboardLayout>
}
