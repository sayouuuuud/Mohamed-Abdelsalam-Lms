'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelCard } from './panel-card'
import { Eye, Users } from 'lucide-react'

const config = {
  views: { label: 'المشاهدات', color: 'var(--chart-1)' },
  visitors: { label: 'زوّار فريدون', color: 'var(--chart-2)' },
} satisfies ChartConfig

type ViewsPoint = { label: string; views: number; visitors: number }

// Client-side slice of the trailing points in the already-fetched series.
// `count: 0` means show everything the global filter returned.
const RANGE_OPTIONS = [
  { label: 'آخر 7 نقاط', value: '7' },
  { label: 'آخر 14 نقطة', value: '14' },
  { label: 'آخر 30 نقطة', value: '30' },
  { label: 'الكل', value: '0' },
]

export function ViewsChart({
  data = [],
  totalViews = 0,
  totalVisitors = 0,
}: {
  data?: ViewsPoint[]
  totalViews?: number
  totalVisitors?: number
}) {
  const [range, setRange] = useState('0')

  const { chartData, viewsSum, visitorsSum } = useMemo(() => {
    const count = Number(range)
    const sliced = count > 0 ? data.slice(-count) : data
    if (count <= 0 || sliced.length === data.length) {
      return { chartData: data, viewsSum: totalViews, visitorsSum: totalVisitors }
    }
    return {
      chartData: sliced,
      viewsSum: sliced.reduce((s, p) => s + (p.views || 0), 0),
      visitorsSum: sliced.reduce((s, p) => s + (p.visitors || 0), 0),
    }
  }, [data, range, totalViews, totalVisitors])

  return (
    <PanelCard
      title="المشاهدات والزيارات"
      actionSlot={
        <div className="flex bg-secondary/50 p-1 rounded-xl items-center border border-border">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setRange(o.value)}
              className={`px-3 py-1.5 text-xs font-semibold transition-all rounded-lg ${
                range === o.value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      }
    >
      {/* Totals summary */}
      <div className="mb-6 flex flex-wrap gap-8">
        <div className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--chart-1)]/20 to-transparent shadow-sm border border-[var(--chart-1)]/10">
            <Eye className="size-5 text-[var(--chart-1)]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-0.5">إجمالي المشاهدات</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-black tracking-tight text-foreground">
                {viewsSum.toLocaleString('en')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--chart-2)]/20 to-transparent shadow-sm border border-[var(--chart-2)]/10">
            <Users className="size-5 text-[var(--chart-2)]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-0.5">زوّار فريدون</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-black tracking-tight text-foreground">
                {visitorsSum.toLocaleString('en')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ChartContainer config={config} className="h-full min-h-[260px] w-full" dir="ltr">
        <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-views)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--color-views)" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-visitors)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--color-visitors)" stopOpacity={0.0} />
            </linearGradient>
            <filter id="glowViews" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="var(--color-views)" floodOpacity="0.4" />
            </filter>
            <filter id="glowVisitors" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="var(--color-visitors)" floodOpacity="0.4" />
            </filter>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--muted-foreground) / 0.2)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} minTickGap={20} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} reversed={true} />
          <YAxis orientation="right" tickLine={false} axisLine={false} width={45} allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
          <ChartTooltip 
            cursor={{ stroke: 'hsl(var(--muted-foreground) / 0.4)', strokeWidth: 1, strokeDasharray: '4 4' }} 
            content={
              <ChartTooltipContent 
                className="bg-background/60 backdrop-blur-xl border border-border shadow-xl rounded-2xl"
              />
            } 
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            dataKey="views"
            type="monotone"
            stroke="var(--color-views)"
            strokeWidth={3}
            fill="url(#fillViews)"
            dot={false}
            activeDot={{ r: 6, fill: "var(--color-views)", stroke: "hsl(var(--background))", strokeWidth: 3 }}
            isAnimationActive={true}
            animationDuration={1500}
            animationEasing="ease-out"
            style={{ filter: 'url(#glowViews)' }}
          />
          <Area
            dataKey="visitors"
            type="monotone"
            stroke="var(--color-visitors)"
            strokeWidth={3}
            fill="url(#fillVisitors)"
            dot={false}
            activeDot={{ r: 6, fill: "var(--color-visitors)", stroke: "hsl(var(--background))", strokeWidth: 3 }}
            isAnimationActive={true}
            animationDuration={1500}
            animationEasing="ease-out"
            style={{ filter: 'url(#glowVisitors)' }}
          />
        </AreaChart>
      </ChartContainer>
    </PanelCard>
  )
}
