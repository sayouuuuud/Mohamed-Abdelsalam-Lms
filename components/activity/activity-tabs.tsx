'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ActivityLogTable } from './activity-log-table'
import { AuthLogTable } from './auth-log-table'
import type { ActivityLog, AuthLog, ActorOption } from '@/app/admin/activity/actions'

const TABS = [
  { id: 'activity', label: 'سجل النشاط' },
  { id: 'auth', label: 'سجل الدخول' },
] as const

type TabId = (typeof TABS)[number]['id']

export function ActivityTabs({
  initialActivityLogs,
  initialActivityTotal,
  initialAuthLogs,
  initialAuthTotal,
  actors,
}: {
  initialActivityLogs: ActivityLog[]
  initialActivityTotal: number
  initialAuthLogs: AuthLog[]
  initialAuthTotal: number
  actors: ActorOption[]
}) {
  const [active, setActive] = useState<TabId>('activity')

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-secondary/40 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'rounded-lg px-5 py-2 text-sm font-medium transition-colors',
              active === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {active === 'activity' ? (
        <ActivityLogTable
          initialLogs={initialActivityLogs}
          initialTotal={initialActivityTotal}
          actors={actors}
        />
      ) : (
        <AuthLogTable
          initialLogs={initialAuthLogs}
          initialTotal={initialAuthTotal}
          actors={actors}
        />
      )}
    </div>
  )
}
