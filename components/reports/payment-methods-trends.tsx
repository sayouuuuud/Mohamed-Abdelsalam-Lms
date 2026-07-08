'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import { Wallet } from 'lucide-react'

export function PaymentMethodsTrends({
  data,
}: {
  data?: { month: string; method: string; count: number; sum_amount?: number }[]
}) {
  const trendsData = data || []
  
  // Total sum
  const totalAmount = trendsData.reduce((acc, curr) => acc + Number(curr.sum_amount || curr.count), 0)

  // Calculate percentage change (current month vs previous month)
  const months = [...new Set(trendsData.map(d => d.month))].sort()
  const currentMonth = months[months.length - 1]
  const prevMonth = months[months.length - 2]

  const currentSum = trendsData.filter(d => d.month === currentMonth).reduce((acc, curr) => acc + Number(curr.sum_amount || curr.count), 0)
  const prevSum = trendsData.filter(d => d.month === prevMonth).reduce((acc, curr) => acc + Number(curr.sum_amount || curr.count), 0)

  const percentageChange = prevSum > 0 ? ((currentSum - prevSum) / prevSum) * 100 : 0
  const isPositive = percentageChange >= 0

  // Group by method
  const methodTotals: Record<string, number> = {
    'المحفظة الإلكترونية': 0,
    'إنستاباي': 0
  }
  trendsData.forEach(d => {
    let key = 'المحفظة الإلكترونية'
    if (d.method.includes('انستا') || d.method.includes('instapay')) {
      key = 'إنستاباي'
    } else {
      key = 'المحفظة الإلكترونية'
    }

    methodTotals[key] = (methodTotals[key] || 0) + Number(d.sum_amount || d.count)
  })

  const methodsArray = Object.entries(methodTotals).map(([name, val]) => ({ name, val }))
  methodsArray.sort((a, b) => b.val - a.val)

  // Colors mapping
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'إنستاباي': return 'bg-purple-500'
      case 'المحفظة الإلكترونية': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  return (
    <PanelCard title="اتجاهات طرق الدفع">
      <div className="flex flex-col gap-6 p-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium text-lg">إجمالي المدفوعات</span>
          <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm">
            <Wallet className="size-4" />
            طرق الدفع
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold tracking-tight text-foreground" dir="ltr">
            {totalAmount.toLocaleString()} ج.م
          </span>
          <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`} dir="ltr">
            {isPositive ? '+' : ''}{percentageChange.toFixed(1)}%
          </span>
        </div>

        <div className="my-2 h-px w-full bg-border" />

        <div className="flex flex-col gap-4">
          <div className="flex w-full h-3 gap-1">
            {methodsArray.map(m => {
              const percentage = totalAmount > 0 ? (m.val / totalAmount) * 100 : 0
              if (percentage === 0) return null
              return (
                <div 
                  key={m.name} 
                  className={`h-full rounded-full ${getMethodColor(m.name)}`} 
                  style={{ width: `${Math.max(percentage, 2)}%` }} 
                  title={`${m.name}: ${percentage.toFixed(1)}%`}
                />
              )
            })}
          </div>

          <div className="flex items-center justify-between w-full mt-2 overflow-x-auto gap-4 scrollbar-hide">
            {methodsArray.map(m => {
              const percentage = totalAmount > 0 ? Math.round((m.val / totalAmount) * 100) : 0
              return (
                <div key={m.name} className="flex flex-col gap-1 min-w-max">
                  <span className="text-muted-foreground text-xs font-medium">{m.name}</span>
                  <span className="font-bold text-sm text-foreground">{percentage}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </PanelCard>
  )
}
