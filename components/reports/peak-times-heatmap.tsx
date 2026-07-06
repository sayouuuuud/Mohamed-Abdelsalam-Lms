'use client'

import { PanelCard } from '@/components/dashboard/panel-card'
import { cn } from '@/lib/utils'

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const formatHour = (h: number) => {
  if (h === 0) return '12 ص'
  if (h === 12) return '12 م'
  if (h > 12) return `${h - 12} م`
  return `${h} ص`
}

export function PeakTimesHeatmap({
  data,
}: {
  data?: { day_of_week: number; hour_of_day: number; activity_count: number }[]
}) {
  const peakData = data || []
  
  // Create a 7x24 grid
  const grid = Array(7).fill(0).map(() => Array(24).fill(0))
  let maxVal = 1

  peakData.forEach(d => {
    const day = Math.floor(Number(d.day_of_week))
    const hour = Math.floor(Number(d.hour_of_day))
    if (day >= 0 && day <= 6 && hour >= 0 && hour <= 23) {
      const val = Number(d.activity_count)
      grid[day][hour] = val
      if (val > maxVal) maxVal = val
    }
  })

  const getColor = (val: number) => {
    if (val === 0) return 'bg-secondary/40 border-transparent'
    const intensity = val / maxVal
    if (intensity <= 0.25) return 'bg-primary/20 border-primary/10'
    if (intensity <= 0.5) return 'bg-primary/50 border-primary/20'
    if (intensity <= 0.75) return 'bg-primary/80 border-primary/30'
    return 'bg-primary border-primary/50'
  }

  return (
    <PanelCard title="أوقات الذروة (المشتريات)">
      <div className="overflow-x-auto pb-6">
        <div className="min-w-[800px] text-xs">
          {/* Header row for hours */}
          <div className="flex mb-3 ml-20">
            {HOURS.map(h => (
              <div key={h} className="flex-1 text-center text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                {h % 2 === 0 ? formatHour(h) : ''}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="flex flex-col gap-1.5">
            {DAYS.map((dayName, dayIndex) => (
              <div key={dayIndex} className="flex items-center group/row">
                <div className="w-20 pr-4 text-xs font-semibold text-muted-foreground transition-colors group-hover/row:text-foreground shrink-0">
                  {dayName}
                </div>
                <div className="flex flex-1 gap-1.5">
                  {HOURS.map(hour => {
                    const val = grid[dayIndex][hour]
                    return (
                      <div
                        key={`${dayIndex}-${hour}`}
                        className="group relative flex-1"
                      >
                        <div
                          className={cn(
                            "w-full aspect-square rounded-md border transition-all duration-300",
                            getColor(val),
                            "hover:ring-2 hover:ring-primary/40 hover:scale-110 hover:z-10 cursor-pointer"
                          )}
                        />
                        {/* Custom Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-max rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-lg group-hover:block z-50 animate-in fade-in zoom-in-95 duration-200">
                          {dayName} - {formatHour(hour)}
                          <div className="mt-1 font-bold text-primary flex items-center justify-center gap-1">
                            <span>{val}</span>
                            <span>طلبات</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 flex items-center justify-end gap-3 text-xs font-medium text-muted-foreground">
            <span>أقل</span>
            <div className="flex gap-1.5">
              <div className="size-4 rounded-sm bg-secondary/40 border border-transparent" />
              <div className="size-4 rounded-sm bg-primary/20 border border-primary/10" />
              <div className="size-4 rounded-sm bg-primary/50 border border-primary/20" />
              <div className="size-4 rounded-sm bg-primary/80 border border-primary/30" />
              <div className="size-4 rounded-sm bg-primary border border-primary/50" />
            </div>
            <span>أكثر</span>
          </div>
        </div>
      </div>
    </PanelCard>
  )
}
