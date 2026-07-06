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
    // When showing everything, keep the server-computed totals; otherwise
    // recompute from the visible slice so the summary matches the filter.
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
      filterOptions={RANGE_OPTIONS}
      filterValue={range}
      onFilterChange={setRange}
    >
      {/* Totals summary */}
      <div className="mb-4 flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--chart-1)]/10">
            <Eye className="size-4 text-[var(--chart-1)]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">إجمالي المشاهدات</p>
            <p className="text-lg font-bold text-foreground">
              {viewsSum.toLocaleString('en')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--chart-2)]/10">
            <Users className="size-4 text-[var(--chart-2)]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">زوّار فريدون</p>
            <p className="text-lg font-bold text-foreground">
              {visitorsSum.toLocaleString('en')}
            </p>
          </div>
        </div>
      </div>

      <ChartContainer config={config} className="h-full min-h-[260px] w-full">
        <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-views)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-visitors)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--color-visitors)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            dataKey="views"
            type="monotone"
            stroke="var(--color-views)"
            strokeWidth={2.5}
            fill="url(#fillViews)"
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Area
            dataKey="visitors"
            type="monotone"
            stroke="var(--color-visitors)"
            strokeWidth={2.5}
            fill="url(#fillVisitors)"
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </PanelCard>
  )
}
