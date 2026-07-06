'use client'

import { CheckCheck, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCanManage } from '@/components/dashboard/permissions-context'

export function NotificationsPageHeader({
  onMarkAllRead,
  unreadCount,
  onCompose,
}: {
  onMarkAllRead: () => void
  unreadCount: number
  onCompose: () => void
}) {
  const canManage = useCanManage('notifications')
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">الإشعارات</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          متابعة جميع التنبيهات وإرسال إعلانات للطلاب
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-border bg-card text-foreground hover:bg-secondary"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
        >
          <CheckCheck className="size-4" />
          تعليم الكل كمقروء
        </Button>
        {canManage && (
          <Button onClick={onCompose}>
            <Send className="size-4" />
            إرسال إشعار للطلاب
          </Button>
        )}
      </div>
    </div>
  )
}
