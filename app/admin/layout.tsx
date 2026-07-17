import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { getPermissionMap, getCurrentRole } from '@/lib/auth-guard'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const role = await getCurrentRole()
  const permissions = role === 'admin' ? undefined : await getPermissionMap()

  return <DashboardLayout permissions={permissions}>{children}</DashboardLayout>
}
