import { GraduationCap, Target, Clock, FileCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AnalyticsKpis({ stats }: { stats?: any }) {
  const s = stats || {}

  const cards = [
    {
      label: 'نسبة النجاح',
      value: `${s.passRate ?? 0}%`,
      sub: 'من كل التسليمات المصححة',
      icon: GraduationCap,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'متوسط الدرجات',
      value: `${s.avgScorePct ?? 0}%`,
      sub: 'متوسط نسب كل الامتحانات',
      icon: Target,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'مدفوعات معلّقة',
      value: (s.pendingPaymentsCount ?? 0).toLocaleString(),
      sub: `${(s.pendingPaymentsAmount ?? 0).toLocaleString()} ج.م بانتظار المراجعة`,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
    {
      label: 'محتاج تصحيح',
      value: (s.pendingGrading ?? 0).toLocaleString(),
      sub: 'تسليمات بانتظار التصحيح اليدوي',
      icon: FileCheck,
      color: 'text-rose-600',
      bg: 'bg-rose-50 dark:bg-rose-500/10',
    },
  ]

  return (
    <div className="ns-stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="ns-card gap-0 p-5">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <div
              className={cn(
                'ns-icon flex size-10 items-center justify-center rounded-xl',
                c.bg,
              )}
            >
              <c.icon className={cn('size-5', c.color)} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-foreground">{c.value}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{c.sub}</p>
        </Card>
      ))}
    </div>
  )
}
