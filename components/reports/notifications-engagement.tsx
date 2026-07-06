'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import { DonutChart } from '@/components/ui/donut-chart'

export function NotificationsEngagement({
  data,
}: {
  data?: { total_sent: number; total_read: number }
}) {
  const sent = Number(data?.total_sent || 0)
  const read = Number(data?.total_read || 0)
  const unread = Math.max(sent - read, 0)
  const readRate = sent > 0 ? Math.round((read / sent) * 100) : 0

  return (
    <PanelCard title="تفاعل الطلاب مع الإشعارات">
      <div className="flex flex-col items-center justify-center pt-2">
        {sent > 0 ? (
          <div className="flex w-full items-center justify-between px-4">
            <DonutChart
              data={[
                { label: 'تمت القراءة', value: read, color: 'var(--chart-1)' },
                { label: 'لم تقرأ', value: unread, color: 'var(--chart-5)' },
              ]}
              size={160}
              strokeWidth={20}
              centerContent={
                <div className="flex flex-col items-center justify-center">
                  <span className="fill-foreground text-2xl font-bold">{readRate}%</span>
                  <span className="fill-muted-foreground text-xs">نسبة القراءة</span>
                </div>
              }
            />
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">إجمالي المُرسل</span>
                <span className="text-xl font-bold text-foreground">{sent.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">تمت القراءة</span>
                <span className="text-xl font-bold text-emerald-600">{read.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-sm text-muted-foreground">لا توجد إشعارات مرسلة بعد</div>
        )}
      </div>
    </PanelCard>
  )
}
