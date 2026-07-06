import { Card } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

type PeriodStat = {
  label: string
  current: number
  previous: number
  suffix: string
  change: number
  up: boolean
}

function CompareCard({ stat }: { stat: PeriodStat }) {
  const isNeutral = stat.change === 0
  const Icon = isNeutral ? Minus : stat.up ? TrendingUp : TrendingDown

  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{stat.label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {stat.current.toLocaleString('en')}
            <span className="mr-1 text-sm font-normal text-muted-foreground">{stat.suffix}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            الشهر السابق:{' '}
            <span className="font-medium text-foreground">{stat.previous.toLocaleString('en')}</span>
          </p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold',
            isNeutral
              ? 'bg-secondary text-muted-foreground'
              : stat.up
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
          )}
        >
          <Icon className="size-3.5" />
          {isNeutral ? '—' : `${Math.abs(stat.change)}%`}
        </div>
      </div>
      {/* Progress bar: current vs previous */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>الشهر الحالي</span>
          <span>الشهر السابق</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="absolute inset-y-0 right-0 rounded-full bg-primary transition-all"
            style={{
              width: `${
                stat.previous > 0
                  ? Math.min((stat.current / Math.max(stat.current, stat.previous)) * 100, 100)
                  : 100
              }%`,
            }}
          />
        </div>
      </div>
    </Card>
  )
}

export function PeriodComparisonWidget({ data }: { data?: PeriodStat[] }) {
  const stats = data || []
  if (stats.length === 0) return null
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold text-foreground">مقارنة الشهر الحالي بالسابق</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <CompareCard key={s.label} stat={s} />
        ))}
      </div>
    </div>
  )
}
