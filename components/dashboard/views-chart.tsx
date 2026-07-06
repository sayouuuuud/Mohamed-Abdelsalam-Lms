'use client'

import { useMemo, useState } from 'react'
import { PanelCard } from './panel-card'
import { Eye, Users, TrendingUp } from 'lucide-react'

type ViewsPoint = { label: string; views: number; visitors: number }

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
  const [range, setRange] = useState('30')
  const [metric, setMetric] = useState<"views" | "visitors">("views")
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  const { chartData, viewsSum, visitorsSum, totalDays } = useMemo(() => {
    const count = Number(range)
    const sliced = count > 0 ? data.slice(-count) : data
    if (count <= 0 || sliced.length === data.length) {
      return { chartData: data, viewsSum: totalViews, visitorsSum: totalVisitors, totalDays: data.length }
    }
    return {
      chartData: sliced,
      viewsSum: sliced.reduce((s, p) => s + (p.views || 0), 0),
      visitorsSum: sliced.reduce((s, p) => s + (p.visitors || 0), 0),
      totalDays: sliced.length
    }
  }, [data, range, totalViews, totalVisitors])

  const metricData = chartData.map((d, i) => ({
    ...d,
    dayIndex: i,
    value: metric === "views" ? (d.views || 0) : (d.visitors || 0)
  }))

  const maxValue = Math.max(...metricData.map((d) => d.value), 10)
  const totalValue = metric === "views" ? viewsSum : visitorsSum
  const avgValue = Math.round(totalValue / (totalDays || 1))
  const dotSize = 8
  const dotsPerColumn = 10

  const renderDots = (value: number, dayIndex: number, label: string) => {
    const normalizedValue = Math.min(value, maxValue)
    const filledDots = maxValue > 0 ? Math.round((normalizedValue / maxValue) * dotsPerColumn) : 0
    const isSelected = selectedDay === dayIndex
    const isHovered = hoveredDay === dayIndex

    return (
      <div
        className="flex flex-col-reverse gap-[2px] cursor-pointer relative group"
        onMouseEnter={() => setHoveredDay(dayIndex)}
        onMouseLeave={() => setHoveredDay(null)}
        onClick={() => setSelectedDay(selectedDay === dayIndex ? null : dayIndex)}
      >
        {/* Tooltip */}
        {isHovered && (
          <div dir="rtl" className={`absolute bottom-full mb-2 ${dayIndex > totalDays - 3 ? "left-0" : dayIndex < 4 ? "right-0" : "left-1/2 -translate-x-1/2"} bg-foreground text-background px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap z-10 shadow-xl border border-border`}>
            {label}: {value.toLocaleString('en')} {metric === "views" ? "مشاهدة" : "زائر"}
          </div>
        )}
        {Array.from({ length: dotsPerColumn }).map((_, index) => (
          <div
            key={index}
            className={`rounded-full transition-colors duration-200 ${index >= filledDots ? 'bg-secondary' : ''}`}
            style={{
              width: dotSize,
              height: dotSize,
              backgroundColor:
                index < filledDots
                  ? (isSelected || isHovered ? "hsl(var(--primary))" : (metric === "views" ? "var(--chart-1)" : "var(--chart-2)"))
                  : undefined,
            }}
          />
        ))}
      </div>
    )
  }

  const targetValue = Math.round(maxValue * 0.7)

  return (
    <PanelCard
      title="المشاهدات والزيارات"
      actionSlot={
        <div className="flex bg-secondary/50 p-1 rounded-xl items-center border border-border hidden sm:flex">
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
      <div className="flex flex-col h-full min-h-[300px]">
        {/* Metric Toggle and Quick Stats */}
        <div className="mb-8 flex flex-wrap gap-6 items-center justify-between">
          <div className="flex items-center gap-2 bg-secondary/50 rounded-xl p-1 border border-border w-fit">
              <button
                  onClick={() => setMetric("views")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${metric === "views"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                      }`}
              >
                  <Eye className="size-4" />
                  المشاهدات
              </button>
              <button
                  onClick={() => setMetric("visitors")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${metric === "visitors"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                      }`}
              >
                  <Users className="size-4" />
                  الزوار
              </button>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-6 text-sm">
             <div className="flex flex-col items-end">
                 <span className="text-muted-foreground text-xs mb-1">الإجمالي</span>
                 <span className="font-black text-foreground text-lg">{totalValue.toLocaleString('en')}</span>
             </div>
             <div className="flex flex-col items-end">
                 <span className="text-muted-foreground text-xs mb-1">المتوسط اليومي</span>
                 <span className="font-black text-foreground text-lg">{avgValue.toLocaleString('en')}</span>
             </div>
             <div className="flex flex-col items-end">
                 <span className="text-muted-foreground text-xs mb-1">أعلى يوم</span>
                 <span className="font-black text-foreground text-lg">{maxValue.toLocaleString('en')}</span>
             </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="relative flex-1 flex flex-col justify-end" dir="ltr">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-muted-foreground font-medium z-0">
                <span>{maxValue}</span>
                <span>{Math.round(maxValue * 0.66)}</span>
                <span>{Math.round(maxValue * 0.33)}</span>
                <span>0</span>
            </div>

            {/* Target line with tooltip */}
            <div
                className="absolute left-8 right-0 flex items-center z-0"
                style={{ top: `${((maxValue - targetValue) / maxValue) * 100}%` }}
            >
                <div className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <TrendingUp className="h-3 w-3" />
                    <span className="font-bold">{targetValue}</span>
                </div>
                <div className="flex-1 border-t border-dashed border-primary/30 ml-2" />
            </div>

            {/* Dots Chart */}
            <div
                className="ml-10 flex items-end justify-between gap-1 overflow-x-auto overflow-y-hidden pb-2 scrollbar-hide z-10 relative"
                style={{ height: 160 }}
            >
                {metricData.map((item) => (
                    <div key={item.dayIndex} className="flex flex-col items-center flex-shrink-0 px-[1px]">
                        {renderDots(item.value, item.dayIndex, item.label)}
                    </div>
                ))}
            </div>

            {/* X-axis labels */}
            <div className="ml-10 flex justify-between mt-2 text-[10px] text-muted-foreground font-medium">
                {metricData
                    .filter((_, i) => (metricData.length - 1 - i) % (totalDays > 20 ? 5 : 2) === 0)
                    .map((item) => (
                        <span key={item.dayIndex}>
                            {item.label}
                        </span>
                    ))}
            </div>
        </div>
      </div>
    </PanelCard>
  )
}
