'use client'

import { PanelCard } from '@/components/dashboard/panel-card'


export function CourseDropoffChart({
  data,
}: {
  data?: { lesson: string; completion_count: number }[]
}) {
  const chartData = data || []

  return (
    <PanelCard title="نقاط الانسحاب (دروس تحتاج لمراجعة)">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground mb-2">
          هذه الدروس هي الأقل إكمالاً من قبل الطلاب. يُنصح بمراجعتها والتأكد من عدم وجود صعوبات تواجه الطلاب فيها.
        </p>
        {chartData.length > 0 ? (
          <div className="overflow-y-auto max-h-[180px] scrollbar-hide pr-1 flex flex-col">
            {chartData.map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b last:border-0 pb-3 mb-3 last:pb-0 last:mb-0">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{item.lesson}</span>
                    <span className="text-xs text-red-500 font-medium">احتمال صعوبة أو ملل</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-lg font-bold text-foreground">
                    {item.completion_count}
                  </span>
                  <span className="text-[10px] text-muted-foreground">طالب أكملوه</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">
            لا توجد بيانات دراسة بعد
          </div>
        )}
      </div>
    </PanelCard>
  )
}
