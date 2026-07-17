import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-guard'
import {
  getActivityLogs,
  getAuthLogs,
  getActivityStats,
  getActorsList,
} from './actions'
import { ActivityStatsCards } from '@/components/activity/activity-stats'
import { ActivityTabs } from '@/components/activity/activity-tabs'

export const metadata = {
  title: 'سجل المراقبة',
  description: 'مراقبة نشاط الفريق وتسجيلات الدخول',
}

export default async function ActivityPage() {
  const isAdmin = await requireAdmin()
  if (!isAdmin) redirect('/admin/no-access')

  const [{ logs: activityLogs, total: activityTotal }, { logs: authLogs, total: authTotal }, stats, actors] =
    await Promise.all([
      getActivityLogs({ page: 1 }),
      getAuthLogs({ page: 1 }),
      getActivityStats(),
      getActorsList(),
    ])

  return (
    <div className="space-y-6">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">سجل المراقبة</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          متابعة نشاط الفريق وتسجيلات الدخول في الوقت الحقيقي
        </p>
      </div>

      <ActivityStatsCards stats={stats} />

      <ActivityTabs
        initialActivityLogs={activityLogs}
        initialActivityTotal={activityTotal}
        initialAuthLogs={authLogs}
        initialAuthTotal={authTotal}
        actors={actors}
      />
    </div>
  )
}
