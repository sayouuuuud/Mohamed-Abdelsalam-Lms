'use client'

import { useMemo, useState } from 'react'
import { Eye, Users, TrendingUp, ChevronDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ViewsPoint = { label: string; views: number; visitors: number }

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
  const [isRangeOpen, setIsRangeOpen] = useState(false)

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
  const avgValueRaw = totalValue / (totalDays || 1)
  const avgValue = avgValueRaw < 1 && avgValueRaw > 0 ? Number(avgValueRaw.toFixed(1)) : Math.round(avgValueRaw)
  const isCompact = totalDays <= 7
  const dotSize = isCompact ? 18 : 8
  const dotsPerColumn = isCompact ? 6 : 12
  const dotGap = 2
  const dotsHeight = (dotsPerColumn * dotSize) + ((dotsPerColumn - 1) * dotGap) // exactly 118px for both
  const paddingTop = 44 // 44px is enough for single-line tooltips
  const paddingBottom = 8 // 8px bottom padding
  const containerHeight = paddingTop + dotsHeight + paddingBottom // 170px

  const renderDots = (value: number, dayIndex: number, label: string) => {
    const normalizedValue = Math.min(value, maxValue)
    const filledDots = maxValue > 0 ? Math.round((normalizedValue / maxValue) * dotsPerColumn) : 0
    const isSelected = selectedDay === dayIndex
    const isHovered = hoveredDay === dayIndex

    return (
      <div
        className="flex flex-col-reverse cursor-pointer relative group"
        style={{ gap: `${dotGap}px` }}
        onMouseEnter={() => setHoveredDay(dayIndex)}
        onMouseLeave={() => setHoveredDay(null)}
        onClick={() => setSelectedDay(selectedDay === dayIndex ? null : dayIndex)}
      >
        {/* Tooltip */}
        {isHovered && (
          <div 
            dir="rtl" 
            className={`absolute bottom-full mb-2 ${dayIndex > totalDays - 4 ? "right-0" : dayIndex < 4 ? "left-0" : "left-1/2 -translate-x-1/2"} bg-gray-900 dark:bg-gray-100 text-gray-50 dark:text-gray-900 px-4 py-2 rounded-full text-xs whitespace-nowrap z-50 shadow-xl flex items-center gap-2 pointer-events-none`}
          >
            <span className="font-semibold text-gray-400 dark:text-gray-500">
              {label}
            </span>
            <div className="flex items-center gap-1 font-bold">
              <span className="text-sm">{value.toLocaleString("en-US")}</span>
              <span className="text-gray-300 dark:text-gray-700">{metric === "views" ? "مشاهدة" : "زائر"}</span>
            </div>
          </div>
        )}
        {Array.from({ length: dotsPerColumn }).map((_, index) => (
          <div
            key={index}
            className={`rounded-full transition-colors duration-200 ${index >= filledDots ? 'bg-gray-200/50 dark:bg-white/5' : ''}`}
            style={{
              width: dotSize,
              height: dotSize,
              backgroundColor:
                index < filledDots
                  ? (isSelected || isHovered ? "var(--primary)" : "#86efac")
                  : undefined,
            }}
          />
        ))}
      </div>
    )
  }

  const rangeLabel = range === '7' ? 'آخر 7 أيام' : range === '30' ? 'آخر 30 يوم' : 'الكل'

  return (
    <div className="w-full p-6 bg-card rounded-xl border border-border shadow-sm font-sans" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
              <h3 className="font-bold text-lg text-foreground">
                  إحصائيات الزيارات
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                  الإجمالي: {totalValue.toLocaleString("en-US")} | المتوسط:{" "}
                  {avgValue.toLocaleString("en-US")} يومياً
              </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
              {/* Metric Toggle */}
              <div className="flex items-center gap-2 bg-muted rounded-2xl p-1.5 border border-border">
                  <button
                      onClick={() => setMetric("views")}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm transition-colors ${metric === "views"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                  >
                      <Eye className="h-4 w-4" />
                      المشاهدات
                  </button>
                  <button
                      onClick={() => setMetric("visitors")}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm transition-colors ${metric === "visitors"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                  >
                      <Users className="h-4 w-4" />
                      الزوار
                  </button>
              </div>

              {/* Custom Select Dropdown */}
              <div className="relative">
                  <button
                      onClick={() => setIsRangeOpen(!isRangeOpen)}
                      onBlur={() => setTimeout(() => setIsRangeOpen(false), 200)}
                      className="flex items-center justify-between gap-3 bg-card border border-border hover:bg-muted text-foreground text-sm rounded-2xl h-10 px-4 outline-none focus:ring-1 focus:ring-primary transition-colors min-w-[130px]"
                  >
                      <span>{rangeLabel}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isRangeOpen ? "rotate-180" : ""}`} />
                  </button>
                  
                  {isRangeOpen && (
                      <div className="absolute top-full right-0 mt-1.5 w-full bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden flex flex-col p-1.5 animate-in fade-in zoom-in-95 duration-100">
                          {[
                              { value: '7', label: 'آخر 7 أيام' },
                              { value: '30', label: 'آخر 30 يوم' },
                              { value: '0', label: 'الكل' },
                          ].map((opt) => (
                              <button
                                  key={opt.value}
                                  onClick={() => {
                                      setRange(opt.value)
                                      setIsRangeOpen(false)
                                  }}
                                  className={`text-right px-3 py-2 text-sm rounded-xl transition-colors ${range === opt.value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                              >
                                  {opt.label}
                              </button>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-3 text-center border border-border">
              <p className="text-2xl font-bold text-foreground">
                  {totalValue.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-muted-foreground">
                  الإجمالي {metric === "views" ? "المشاهدات" : "الزوار"}
              </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-center border border-border">
              <p className="text-2xl font-bold text-foreground">
                  {avgValue.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-muted-foreground">متوسط يومي</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-center border border-border">
              <p className="text-2xl font-bold text-foreground">
                  {maxValue.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-muted-foreground">أعلى يوم</p>
          </div>
      </div>

      {/* Chart Area */}
      <div className="relative mt-2" dir="ltr">
          {/* Y-axis labels */}
          <div 
              className="absolute right-0 flex flex-col justify-between text-[10px] text-muted-foreground font-medium z-0"
              style={{ top: paddingTop, height: dotsHeight }}
          >
              <span>{maxValue}</span>
              <span>{Math.round(maxValue * 0.66)}</span>
              <span>{Math.round(maxValue * 0.33)}</span>
              <span>0</span>
          </div>

          {/* Dots Chart */}
          <div
              className="mr-8 flex items-end justify-between overflow-x-auto overflow-y-hidden scrollbar-hide z-10 relative"
              style={{ height: containerHeight, paddingTop, paddingBottom, gap: '4px' }}
          >
              {metricData.map((item) => (
                  <div key={item.dayIndex} className="flex flex-col items-center flex-shrink-0 px-[1px]">
                      {renderDots(item.value, item.dayIndex, item.label)}
                  </div>
              ))}
          </div>

          {/* X-axis labels */}
          <div className="mr-12 flex justify-between mt-2 text-xs text-muted-foreground font-medium">
              {metricData
                  .filter((_, i) => (metricData.length - 1 - i) % (totalDays > 20 ? 5 : totalDays > 7 ? 2 : 1) === 0)
                  .map((item) => (
                      <span key={item.dayIndex}>
                          {item.label}
                      </span>
                  ))}
          </div>
      </div>
    </div>
  )
}
