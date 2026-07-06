'use client'

import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from '@/components/dashboard/panel-card'
import { Card } from '@/components/ui/card'
import { Monitor, Smartphone, HelpCircle } from 'lucide-react'

type DailyView = { day: string; views: number; visitors: number }
type DeviceStat = { device: string; count: number; fill: string }

const deviceIcon = {
  mobile: Smartphone,
  desktop: Monitor,
  unknown: HelpCircle,
}
const deviceLabel: Record<string, string> = {
  mobile: 'موبايل',
  desktop: 'ديسكتوب',
  unknown: 'غير معروف',
}

const areaConfig = {
  views: { label: 'المشاهدات', color: 'var(--chart-1)' },
  visitors: { label: 'الزوّار الفريدون', color: 'var(--chart-2)' },
} satisfies ChartConfig

const RANGE_OPTS = [
  { label: 'آخر 7 أيام', value: '7' },
  { label: 'آخر 14 يوم', value: '14' },
  { label: 'آخر 30 يوم', value: '30' },
]

export function ViewsAnalyticsWidget({
  dailyViews,
  deviceBreakdown,
}: {
  dailyViews?: DailyView[]
  deviceBreakdown?: DeviceStat[]
}) {
  const [range, setRange] = useState('14')
  const sliced = (dailyViews || []).slice(-Number(range))
  const devices = deviceBreakdown || []
  const totalDevices = devices.reduce((s, d) => s + d.count, 0) || 1

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Area chart */}
      <div className="lg:col-span-2">
        <PanelCard
          title="المشاهدات اليومية"
          filterOptions={RANGE_OPTS}
          filterValue={range}
          onFilterChange={setRange}
        >
          <ChartContainer config={areaConfig} className="h-[240px] w-full">
            <AreaChart data={sliced} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => v.slice(5)}
                interval="preserveStartEnd"
                tick={{ fontSize: 11 }}
              />
              <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="views" stroke="var(--chart-1)" fill="url(#gViews)" strokeWidth={2} dot={false} />
              <Area dataKey="visitors" stroke="var(--chart-2)" fill="url(#gVisitors)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartContainer>
        </PanelCard>
      </div>

      {/* Device breakdown */}
      <Card className="flex flex-col gap-0 p-5">
        <h3 className="mb-4 text-base font-bold text-foreground">توزيع الأجهزة</h3>
        {devices.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={devices} dataKey="count" nameKey="device" cx="50%" cy="50%" innerRadius={40} outerRadius={65} strokeWidth={0}>
                  {devices.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2">
              {devices.map((d) => {
                const Icon = deviceIcon[d.device as keyof typeof deviceIcon] || HelpCircle
                const pct = Math.round((d.count / totalDevices) * 100)
                return (
                  <div key={d.device} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.fill }} />
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{deviceLabel[d.device] ?? d.device}</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
