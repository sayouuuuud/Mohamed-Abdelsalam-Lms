import { Activity, Users, Clock, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ActivityStats } from '@/app/admin/activity/actions'

function relativeTime(iso: string | null): string {
  if (!iso) return 'لا يوجد'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} ساعة`
  return `منذ ${Math.floor(hrs / 24)} يوم`
}

const cards = (stats: ActivityStats) => [
  {
    label: 'أفعال اليوم',
    value: stats.todayCount.toLocaleString('ar-EG'),
    sub: 'إجمالي العمليات',
    icon: Activity,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    label: 'أعضاء الفريق النشطين',
    value: stats.totalActors.toLocaleString('ar-EG'),
    sub: 'أدمن ومساعدين',
    icon: Users,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  {
    label: 'مساعدون نشطون',
    value: stats.activeAssistants.toLocaleString('ar-EG'),
    sub: 'آخر ٧ أيام',
    icon: TrendingUp,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
  },
  {
    label: 'آخر نشاط',
    value: relativeTime(stats.lastEventAt),
    sub: 'آخر عملية مسجّلة',
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
  },
]

export function ActivityStatsCards({ stats }: { stats: ActivityStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards(stats).map((card) => (
        <Card key={card.label} className="gap-0 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <div className={cn('flex size-10 items-center justify-center rounded-xl', card.bg)}>
              <card.icon className={cn('size-5', card.color)} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">{card.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
        </Card>
      ))}
    </div>
  )
}
