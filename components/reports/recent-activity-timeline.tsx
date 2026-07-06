'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import { ActivityLog } from '@/app/admin/activity/actions'
function formatDistanceToNow(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'منذ لحظات'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `منذ ${minutes} دقيقة`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  if (days < 30) return `منذ ${days} يوم`
  const months = Math.floor(days / 30)
  return `منذ ${months} شهر`
}

const actionLabels: Record<string, string> = {
  create: 'إنشاء',
  update: 'تحديث',
  delete: 'حذف',
  approve: 'موافقة على',
  reject: 'رفض',
}

const resourceLabels: Record<string, string> = {
  courses: 'كورس',
  students: 'طالب',
  payments: 'عملية دفع',
  orders: 'طلب',
  exams: 'امتحان',
  assignments: 'واجب',
  reports: 'تقرير',
  notifications: 'إشعار',
}

export function RecentActivityTimeline({
  logs,
}: {
  logs?: ActivityLog[]
}) {
  const recentLogs = (logs || []).slice(0, 6)

  return (
    <PanelCard title="سجل النشاط الحديث">
      <div className="flex flex-col gap-4">
        {recentLogs.length > 0 ? (
          recentLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-4">
              <div className="mt-1 relative flex h-3 w-3 shrink-0 items-center justify-center">
                <span className="absolute h-full w-full animate-ping rounded-full bg-primary/40 opacity-75"></span>
                <span className="relative h-2 w-2 rounded-full bg-primary"></span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium leading-none text-foreground">
                  قام <span className="font-bold text-primary">{log.actor_name}</span> بـ{' '}
                  <span className="font-semibold">
                    {actionLabels[log.action] || log.action}
                  </span>{' '}
                  {resourceLabels[log.resource] || log.resource}
                  {log.target_label ? ` (${log.target_label})` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(log.created_at)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            لا يوجد أنشطة حديثة
          </div>
        )}
      </div>
    </PanelCard>
  )
}
