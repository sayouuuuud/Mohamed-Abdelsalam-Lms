import type { ReactNode } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { createClient } from '@/lib/supabase/server'
import { getPermissionMap } from '@/lib/auth-guard'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const permissions = await getPermissionMap(supabase)

  return <DashboardLayout permissions={permissions}>{children}</DashboardLayout>
}
