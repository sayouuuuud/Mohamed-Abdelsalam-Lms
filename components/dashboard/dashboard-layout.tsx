'use client'

import { useState, type ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { useTheme } from '@/components/theme-provider'
import { PageTransition } from '@/components/page-transition'
import { PermissionsProvider } from './permissions-context'
import type { PermissionMap } from '@/lib/permissions'

export function DashboardLayout({
  children,
  permissions,
}: {
  children: ReactNode
  permissions?: PermissionMap
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        permissions={permissions}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />

        <main className="flex-1 p-4 sm:p-6">
          <PermissionsProvider permissions={permissions}>
            <PageTransition className="space-y-6">{children}</PageTransition>
          </PermissionsProvider>
        </main>
      </div>
    </div>
  )
}
