'use client'

import { useMemo, useState } from 'react'
import { Eye, Users, TrendingUp, ChevronDown, Download } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
          <div dir="rtl" className={`absolute bottom-full mb-2 ${dayIndex > totalDays - 3 ? "left-0" : dayIndex < 4 ? "right-0" : "left-1/2 -translate-x-1/2"} bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-10 shadow-lg`}>
            {label}: {value.toLocaleString('ar-EG')} {metric === "views" ? "مشاهدة" : "زائر"}
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

  const targetValue = Math.round(maxValue * 0.7)

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
                  الإجمالي: {totalValue.toLocaleString("ar-EG")} | المتوسط:{" "}
                  {avgValue.toLocaleString("ar-EG")} يومياً
              </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
              {/* Metric Toggle */}
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1 border border-border">
                  <button
                      onClick={() => setMetric("views")}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${metric === "views"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                  >
                      <Eye className="h-4 w-4" />
                      المشاهدات
                  </button>
                  <button
                      onClick={() => setMetric("visitors")}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${metric === "visitors"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                  >
                      <Users className="h-4 w-4" />
                      الزوار
                  </button>
              </div>

              {/* Using native select if DropdownMenu is not present or just HTML/Tailwind */}
              <div className="relative">
                  <select
                      value={range}
                      onChange={(e) => setRange(e.target.value)}
                      className="appearance-none bg-card border border-border hover:bg-muted text-foreground text-sm rounded-md h-9 px-3 pr-8 outline-none focus:ring-1 focus:ring-primary"
                  >
                      <option value="7">آخر 7 أيام</option>
                      <option value="30">آخر 30 يوم</option>
                      <option value="0">الكل</option>
                  </select>
                  <ChevronDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>

              <button className="flex items-center justify-center text-muted-foreground bg-card border border-border hover:bg-muted rounded-md h-9 w-9 transition-colors">
                  <Download className="h-4 w-4" />
              </button>
          </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-3 text-center border border-border">
              <p className="text-2xl font-bold text-foreground">
                  {totalValue.toLocaleString("ar-EG")}
              </p>
              <p className="text-xs text-muted-foreground">
                  الإجمالي {metric === "views" ? "المشاهدات" : "الزوار"}
              </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-center border border-border">
              <p className="text-2xl font-bold text-foreground">
                  {avgValue.toLocaleString("ar-EG")}
              </p>
              <p className="text-xs text-muted-foreground">متوسط يومي</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-center border border-border">
              <p className="text-2xl font-bold text-foreground">
                  {maxValue.toLocaleString("ar-EG")}
              </p>
              <p className="text-xs text-muted-foreground">أعلى يوم</p>
          </div>
      </div>

      {/* Chart Area */}
      <div className="relative mt-8" dir="ltr">
          {/* Y-axis labels */}
          <div className="absolute right-0 top-0 bottom-8 flex flex-col justify-between text-xs text-muted-foreground font-medium z-0">
              <span>{maxValue}</span>
              <span>{Math.round(maxValue * 0.66)}</span>
              <span>{Math.round(maxValue * 0.33)}</span>
              <span>0</span>
          </div>

          {/* Target line with tooltip */}
          <div
              className="absolute right-8 left-0 flex items-center z-0"
              style={{ top: `${((maxValue - targetValue) / maxValue) * 100}%` }}
          >
              <div className="bg-primary text-primary-foreground text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <TrendingUp className="h-3 w-3" />
                  <span className="font-bold">{targetValue}</span>
              </div>
              <div
                  className="flex-1 border-t border-dashed border-primary/20"
                  style={{ marginRight: 8 }}
              />
          </div>

          {/* Dots Chart */}
          <div
              className="mr-12 flex items-end justify-between gap-1 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide z-10 relative"
              style={{ height: 220 }}
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
                  .filter((_, i) => (metricData.length - 1 - i) % (totalDays > 20 ? 5 : 2) === 0)
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
