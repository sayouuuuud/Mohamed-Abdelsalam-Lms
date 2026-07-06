import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PanelCard } from './panel-card'
import { getInitials } from '@/lib/get-initials'
import { cn } from '@/lib/utils'

export function LatestPayments({ payments = [] }: { payments?: any[] }) {
  return (
    <PanelCard title="آخر المدفوعات" action="عرض الكل" actionHref="/admin/payments">
      <ul className="divide-y divide-border">
        {payments.map((payment) => (
          <li key={payment.id} className="flex items-center gap-3 py-3 first:pt-0">
            <Avatar className="size-10">
              <AvatarFallback className="bg-secondary text-xs font-semibold text-foreground">
                {getInitials(payment.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{payment.name}</p>
              <p className="truncate text-xs text-muted-foreground">{payment.course}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  payment.status === 'ناجح'
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/15 text-warning-foreground dark:text-warning',
                )}
              >
                {payment.status}
              </span>
            </div>
            <div className="text-end">
              <p dir="ltr" className="text-xs text-muted-foreground text-right">{payment.id}</p>
              <p className="text-sm font-bold text-foreground">{payment.amount}</p>
            </div>
          </li>
        ))}
      </ul>
    </PanelCard>
  )
}
