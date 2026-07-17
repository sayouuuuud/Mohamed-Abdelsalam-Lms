import { Video, ClipboardList, FileText, BookOpenCheck, CalendarDays, PlayCircle } from 'lucide-react'
import { PanelCard } from '@/components/dashboard/panel-card'
import { cn } from '@/lib/utils'
import type { ScheduleItem } from '@/lib/student-types'

const typeConfig: Record<
  ScheduleItem['type'],
  { icon: typeof Video; color: string; bg: string }
> = {
  محاضرة: { icon: Video, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  اختبار: { icon: ClipboardList, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10' },
  واجب: { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  مراجعة: { icon: BookOpenCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  مباشر: { icon: PlayCircle, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
}

export function UpcomingSchedule({ schedule = [] }: { schedule?: ScheduleItem[] }) {
  if (schedule.length === 0) {
    return (
      <PanelCard title="جدولي القادم" action="عرض الكل" actionHref="/student/schedule">
        <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <CalendarDays className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">لا توجد أحداث قادمة</p>
        </div>
      </PanelCard>
    )
  }

  return (
    <PanelCard title="جدولي القادم" action="عرض الكل" actionHref="/student/schedule">
      <ul className="space-y-0.5">
        {schedule.map((item) => {
          const config = typeConfig[item.type] ?? typeConfig['محاضرة']
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-secondary/60"
            >
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-xl',
                  config.bg,
                )}
              >
                <config.icon className={cn('size-5', config.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">{item.course}</p>
              </div>
              <div className="shrink-0 text-left">
                <p className="text-xs font-semibold text-foreground">{item.day}</p>
                <p className="text-[11px] text-muted-foreground">{item.time}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </PanelCard>
  )
}
