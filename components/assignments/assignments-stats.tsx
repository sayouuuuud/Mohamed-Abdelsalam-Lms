import { ClipboardList, Send, Hourglass, Target } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { AssignmentsStatsData } from '@/app/admin/assignments/actions'

export function AssignmentsStats({ stats }: { stats: AssignmentsStatsData | null }) {
  if (!stats) return null

  const computedStats = [
    {
      label: 'إجمالي الواجبات',
      value: stats.total.toString(),
      icon: ClipboardList,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'التسليمات',
      value: stats.totalSubmissions.toLocaleString('ar-EG'),
      icon: Send,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'بانتظار التصحيح',
      value: stats.pendingReview.toLocaleString('ar-EG'),
      icon: Hourglass,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
    {
      label: 'متوسط الدرجات',
      value: stats.avgScore > 0 ? stats.avgScore.toString() : '—',
      icon: Target,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {computedStats.map((stat) => (
        <Card key={stat.label} className="gap-0 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <div className={`flex size-10 items-center justify-center rounded-xl ${stat.bg}`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{stat.value}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
