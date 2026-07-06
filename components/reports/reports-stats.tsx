import { DollarSign, Users, BookOpen, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { reportStats as initialData } from '@/lib/reports-data'

const icons = {
  revenue: { icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
  students: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  enrollments: { icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  refunds: { icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10' },
} as const

export function ReportsStats({ stats: inputStats }: { stats?: any[] }) {
  const reportStats = inputStats || initialData
  return (
    <div className="ns-stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
      {reportStats.map((stat) => {
        const meta = icons[stat.key as keyof typeof icons]
        const Icon = meta.icon
        return (
          <Card key={stat.key} className="ns-card gap-0 p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className={cn('ns-icon flex size-10 items-center justify-center rounded-xl', meta.bg)}>
                <Icon className={cn('size-5', meta.color)} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground">
                {stat.value.toLocaleString('en-US')}
              </span>
              <span className="text-xs text-muted-foreground">{stat.suffix}</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  'flex items-center gap-0.5 text-xs font-semibold',
                  stat.up ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {stat.up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {stat.change}%
              </span>
              <span className="text-xs text-muted-foreground">عن الفترة السابقة</span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
