'use client'

import useSWR from 'swr'
import { PanelCard } from '@/components/dashboard/panel-card'
import { getStudentMonthlyProgress } from '@/app/student/actions'

export function MonthlyProgress() {
  const { data: stats, isLoading } = useSWR(
    'student-monthly-progress',
    getStudentMonthlyProgress,
    { revalidateOnFocus: true },
  )

  return (
    <PanelCard title="إنجازات هذا الشهر">
      <div className="grid grid-cols-2 gap-2">
        {isLoading || !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 rounded-xl bg-secondary/50 px-3 py-2.5"
              >
                <div className="h-6 w-12 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))
          : stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col gap-0.5 rounded-xl bg-secondary/50 px-3 py-2.5"
              >
                <span className="text-xl font-bold text-foreground">{s.value}</span>
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <span
                  className={
                    s.positive === true
                      ? 'text-xs font-semibold text-green-500'
                      : s.positive === false
                        ? 'text-xs font-semibold text-red-500'
                        : 'text-xs text-muted-foreground'
                  }
                >
                  {s.change}
                </span>
              </div>
            ))}
      </div>
    </PanelCard>
  )
}
