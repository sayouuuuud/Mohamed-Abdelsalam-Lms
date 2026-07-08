'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

const formatYMD = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${date}`
}

export function PeakTimesHeatmap({
  data,
}: {
  data?: { date: string; activity_count: number }[]
}) {
  const peakData = data || []
  
  // Build a map for quick lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, number>()
    let max = 1
    peakData.forEach(d => {
      if (!d.date) return
      const count = Number(d.activity_count)
      map.set(d.date, count)
      if (count > max) max = count
    })
    return { map, max }
  }, [peakData])

  const { weeks, startDate, endDate } = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 364) // Last 365 days

    const startDayOfWeek = start.getDay() // 0 is Sunday
    const paddedStart = new Date(start)
    paddedStart.setDate(start.getDate() - startDayOfWeek)

    const endDayOfWeek = end.getDay()
    const paddedEnd = new Date(end)
    paddedEnd.setDate(end.getDate() + (6 - endDayOfWeek))

    const allDays = []
    let current = new Date(paddedStart)
    while (current <= paddedEnd) {
      allDays.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    const wks: Date[][] = []
    for (let i = 0; i < allDays.length; i += 7) {
      wks.push(allDays.slice(i, i + 7))
    }

    const weeksWithLabels = wks.map((week, weekIdx) => {
      const firstDay = week[0]
      const prevWeek = wks[weekIdx - 1]
      const isNewMonth = prevWeek ? firstDay.getMonth() !== prevWeek[0].getMonth() : true
      return { week, isNewMonth }
    })

    return { weeks: weeksWithLabels, startDate: start, endDate: end }
  }, [])

  const displayWeeks = useMemo(() => [...weeks].reverse(), [weeks])

  const getColor = (val: number) => {
    if (val === 0) return 'bg-secondary/40 border-transparent'
    const intensity = val / dataMap.max
    if (intensity <= 0.25) return 'bg-primary/20 border-primary/10'
    if (intensity <= 0.5) return 'bg-primary/50 border-primary/20'
    if (intensity <= 0.75) return 'bg-primary/80 border-primary/30'
    return 'bg-primary border-primary/50'
  }

  return (
    <PanelCard title="أوقات الذروة (المشتريات)">
      <div className="overflow-x-auto pb-6 custom-scrollbar">
        <div className="min-w-max text-xs flex gap-2">
          
          {/* Day Labels (Y Axis) */}
          <div className="flex flex-col gap-1 mt-[1.375rem] sticky right-0 bg-card z-20">
            {DAYS_AR.map((dayName, idx) => (
              <div key={idx} className="h-3 text-[10px] font-medium text-muted-foreground flex items-center justify-end pr-2 w-8 shrink-0">
                {idx % 2 !== 0 ? dayName : ''}
              </div>
            ))}
          </div>

          {/* Graph Grid */}
          <div className="flex flex-col gap-2">
            
            {/* Month Labels (X Axis) */}
            <div className="flex gap-1">
              {displayWeeks.map(({ week, isNewMonth }, idx) => {
                return (
                  <div key={idx} className="relative w-3 h-3.5 shrink-0">
                    {isNewMonth && (
                      <span className="absolute right-0 text-[10px] text-muted-foreground whitespace-nowrap">
                        {MONTHS_AR[week[0].getMonth()]}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Cells */}
            <div className="flex gap-1">
              {displayWeeks.map(({ week }, idx) => (
                <div key={idx} className="flex flex-col gap-1 shrink-0">
                  {week.map((day, dayIdx) => {
                    const dateStr = formatYMD(day)
                    const val = dataMap.map.get(dateStr) || 0
                    const isOutOfRange = day < startDate || day > endDate
                    
                    return (
                      <div
                        key={dayIdx}
                        className="group relative size-3 shrink-0"
                      >
                        {!isOutOfRange ? (
                          <>
                            <div
                              className={cn(
                                "w-full h-full rounded-[2px] border transition-all duration-300",
                                getColor(val),
                                "hover:ring-2 hover:ring-primary/40 hover:scale-110 hover:z-10 cursor-pointer"
                              )}
                            />
                            {/* Custom Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-max rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-lg group-hover:block z-50 animate-in fade-in zoom-in-95 duration-200">
                              {day.getDate()} {MONTHS_AR[day.getMonth()]} {day.getFullYear()}
                              <div className="mt-1 font-bold text-primary flex items-center justify-center gap-1">
                                <span>{val}</span>
                                <span>طلبات</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full rounded-sm bg-transparent" />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 flex items-center justify-end gap-3 text-xs font-medium text-muted-foreground pr-8">
          <span>أقل</span>
          <div className="flex gap-1.5">
            <div className="size-3 rounded-[2px] bg-secondary/40 border border-transparent" />
            <div className="size-3 rounded-[2px] bg-primary/20 border border-primary/10" />
            <div className="size-3 rounded-[2px] bg-primary/50 border border-primary/20" />
            <div className="size-3 rounded-[2px] bg-primary/80 border border-primary/30" />
            <div className="size-3 rounded-[2px] bg-primary border border-primary/50" />
          </div>
          <span>أكثر</span>
        </div>
      </div>
    </PanelCard>
  )
}
