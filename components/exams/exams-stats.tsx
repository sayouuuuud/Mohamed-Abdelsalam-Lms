import { FileText, CheckCircle2, Users, Target, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ExamsStatsData = {
  total: number
  totalChange: number
  published: number
  publishedChange: number
  participants: number
  participantsChange: number
  avgScore: number
  avgScoreChange: number
}

export function ExamsStats({ stats }: { stats: ExamsStatsData | null }) {
  if (!stats) return null

  const formatChange = (change: number, isPercentValue: boolean = false) => {
    const sign = change > 0 ? '+' : ''
    return `${sign}${change}${isPercentValue ? '' : '%'}`
  }

  const computedStats = [
    {
      label: 'إجمالي الاختبارات',
      value: stats.total.toString(),
      change: formatChange(stats.totalChange),
      sub: 'عن 30 يوم السابقة',
      icon: FileText,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'الاختبارات المنشورة',
      value: stats.published.toString(),
      change: formatChange(stats.publishedChange),
      sub: 'عن 30 يوم السابقة',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'إجمالي المشاركات',
      value: stats.participants.toLocaleString(),
      change: formatChange(stats.participantsChange),
      sub: 'عن 30 يوم السابقة',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'متوسط الدرجات',
      value: `${stats.avgScore}%`,
      change: formatChange(stats.avgScoreChange, true) + '%',
      sub: 'عن 30 يوم السابقة',
      icon: Target,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {computedStats.map((stat) => (
        <Card key={stat.label} className="gap-0 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-xl',
                stat.bg,
              )}
            >
              <stat.icon className={cn('size-5', stat.color)} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{stat.value}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                'flex items-center gap-0.5 font-semibold',
                stat.change.startsWith('-') ? 'text-rose-600' : 'text-emerald-600',
              )}
            >
              <TrendingUp
                className={cn('size-3.5', stat.change.startsWith('-') && 'rotate-180')}
              />
              {stat.change}
            </span>
            <span className="text-muted-foreground">{stat.sub}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
