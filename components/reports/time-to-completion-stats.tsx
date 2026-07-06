'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import { Timer } from 'lucide-react'

export function TimeToCompletionStats({
  data,
}: {
  data?: { course: string; avg_days: number }[]
}) {
  const stats = data || []

  return (
    <PanelCard title="متوسط وقت إنجاز المحاضرات">
      <div className="flex flex-col gap-4">
        {stats.length > 0 ? (
          <div className="overflow-y-auto max-h-[170px] scrollbar-hide pr-1 flex flex-col">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center justify-between border-b last:border-0 pb-3 mb-3 last:pb-0 last:mb-0">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Timer className="size-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{s.course}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  {Math.round(s.avg_days) === 0 ? (
                    <span className="text-xl font-bold text-foreground">
                      أقل من يوم
                    </span>
                  ) : (
                    <>
                      <span className="text-xl font-bold text-foreground">
                        {Math.round(s.avg_days)}
                      </span>
                      <span className="text-xs text-muted-foreground">أيام</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-6">
            لا يوجد طلاب أنهوا كورسات بالكامل بعد
          </div>
        )}
      </div>
    </PanelCard>
  )
}
