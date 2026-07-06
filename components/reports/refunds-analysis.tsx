'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import { Ban, Undo2 } from 'lucide-react'

export function RefundsAnalysis({
  data,
}: {
  data?: { refunded_count: number; refunded_sum: number; cancelled_count: number; cancelled_sum: number }
}) {
  const refCount = Number(data?.refunded_count || 0)
  const refSum = Number(data?.refunded_sum || 0)
  const canCount = Number(data?.cancelled_count || 0)
  const canSum = Number(data?.cancelled_sum || 0)

  return (
    <PanelCard title="تحليل الاسترداد والإلغاءات">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Undo2 className="size-5 text-amber-500" />
            <span className="font-medium">المدفوعات المستردة</span>
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">{refCount} طلب</div>
          <div className="text-sm font-semibold text-amber-600">
            بقيمة {refSum.toLocaleString()} ج.م
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Ban className="size-5 text-destructive" />
            <span className="font-medium">المدفوعات الملغاة</span>
          </div>
          <div className="mt-2 text-3xl font-bold text-foreground">{canCount} طلب</div>
          <div className="text-sm font-semibold text-destructive">
            بقيمة {canSum.toLocaleString()} ج.م
          </div>
        </div>
      </div>
    </PanelCard>
  )
}
