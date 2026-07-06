'use client'

import { PanelCard } from '@/components/dashboard/panel-card'

type FunnelStage = { stage: string; value: number; fill: string }

function FunnelBar({ stage, value, max, fill }: FunnelStage & { max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const convPct = max > 0 ? ((value / max) * 100).toFixed(1) : '0'
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-right text-xs font-medium text-muted-foreground">{stage}</span>
      <div className="relative flex-1">
        <div className="h-8 w-full overflow-hidden rounded-lg bg-secondary">
          <div
            className="h-full rounded-lg transition-all duration-700"
            style={{ width: `${pct}%`, background: fill }}
          />
        </div>
        <span className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-foreground">
          {value.toLocaleString('en')}
        </span>
      </div>
      <span className="w-12 shrink-0 text-left text-xs text-muted-foreground">{convPct}%</span>
    </div>
  )
}

export function ConversionFunnelChart({ data }: { data?: FunnelStage[] }) {
  const stages = data || []
  const max = stages[0]?.value || 1

  if (stages.length === 0 || max === 0) {
    return (
      <PanelCard title="قمع التحويل">
        <p className="py-10 text-center text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard title="قمع التحويل" filter="آخر 30 يوم">
      <div className="space-y-3 py-2">
        {stages.map((s) => (
          <FunnelBar key={s.stage} {...s} max={max} />
        ))}
        <p className="pt-2 text-xs text-muted-foreground">
          معدّل التحويل الإجمالي:{' '}
          <span className="font-semibold text-foreground">
            {max > 0 && stages.length > 1
              ? `${((stages[stages.length - 1].value / max) * 100).toFixed(1)}%`
              : '—'}
          </span>
        </p>
      </div>
    </PanelCard>
  )
}
