'use client'

import { useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  ClipboardList,
  FileText,
  BookOpenCheck,
  Video,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  weekDays,
  monthNames,
  scheduleTypeStyles,
  getScheduleTypeStyle,
  type ScheduleEvent,
  type ScheduleEventType,
} from '@/lib/student-schedule-data'

function dateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const todayKey = dateKey(new Date())

const typeIcons: Record<ScheduleEventType, typeof Video> = {
  محاضرة: GraduationCap,
  اختبار: ClipboardList,
  واجب: FileText,
  مراجعة: BookOpenCheck,
  مباشر: Video,
}

export function StudentSchedulePage({ scheduleEvents = [] }: { scheduleEvents?: ScheduleEvent[] }) {
  const [current, setCurrent] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey)

  const year = current.getFullYear()
  const month = current.getMonth()

  const goToMonth = (offset: number) =>
    setCurrent((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
  const goToToday = () => {
    const d = new Date()
    setCurrent(new Date(d.getFullYear(), d.getMonth(), 1))
    setSelectedDate(todayKey)
  }

  // خريطة الأحداث حسب التاريخ
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>()
    for (const ev of scheduleEvents) {
      const list = map.get(ev.date) ?? []
      list.push(ev)
      map.set(ev.date, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time))
    return map
  }, [])

  // بناء خلايا الشبكة (تبدأ من السبت)
  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() + 1) % 7 // السبت = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const result: Array<{ key: string; day: number } | null> = []
    for (let i = 0; i < startOffset; i++) result.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ key: dateKey(new Date(year, month, d)), day: d })
    }
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [year, month])

  // الأحداث القادمة (من اليوم فصاعدًا)
  const upcoming = useMemo(
    () =>
      [...scheduleEvents]
        .filter((e) => e.date >= todayKey)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [],
  )

  // إحصائيات الشهر المعروض
  const stats = useMemo(() => {
    const inMonth = scheduleEvents.filter((e) => {
      const [ey, em] = e.date.split('-').map(Number)
      return ey === year && em === month + 1
    })
    return [
      {
        label: 'أحداث هذا الشهر',
        value: inMonth.length,
        icon: CalendarDays,
        color: 'text-primary',
        bg: 'bg-primary/10',
      },
      {
        label: 'المحاضرات',
        value: inMonth.filter((e) => e.type === 'محاضرة').length,
        icon: GraduationCap,
        color: 'text-blue-600',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
      },
      {
        label: 'الاختبارات',
        value: inMonth.filter((e) => e.type === 'اختبار').length,
        icon: ClipboardList,
        color: 'text-rose-600',
        bg: 'bg-rose-50 dark:bg-rose-500/10',
      },
      {
        label: 'الواجبات',
        value: inMonth.filter((e) => e.type === 'واجب').length,
        icon: FileText,
        color: 'text-amber-600',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
      },
    ]
  }, [year, month])

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : []

  const formatDateLabel = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    return `${d} ${monthNames[m - 1]} ${y}`
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">جدولي</h1>
        <p className="text-sm text-muted-foreground">
          تابع مواعيد محاضراتك واختباراتك وواجباتك في مكان واحد.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-0 p-5 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl',
                  stat.bg,
                )}
              >
                <stat.icon className={cn('size-5', stat.color)} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Calendar + Sidebar */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* الشبكة */}
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="size-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {monthNames[month]} {year}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-card text-foreground hover:bg-secondary"
                onClick={goToToday}
              >
                اليوم
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 border-border bg-card text-foreground hover:bg-secondary"
                  onClick={() => goToMonth(1)}
                  aria-label="الشهر التالي"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 border-border bg-card text-foreground hover:bg-secondary"
                  onClick={() => goToMonth(-1)}
                  aria-label="الشهر السابق"
                >
                  <ChevronLeft className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* أيام الأسبوع */}
          <div className="grid grid-cols-7 border-b border-border bg-secondary/40">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-2.5 text-center text-xs font-semibold text-muted-foreground"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.slice(0, 3)}</span>
              </div>
            ))}
          </div>

          {/* الخلايا */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${i}`}
                    className="min-h-20 border-b border-l border-border bg-secondary/20 sm:min-h-28"
                  />
                )
              }
              const dayEvents = eventsByDate.get(cell.key) ?? []
              const isToday = cell.key === todayKey
              const isSelected = cell.key === selectedDate
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDate(cell.key)}
                  className={cn(
                    'group relative flex min-h-20 flex-col gap-1 border-b border-l border-border p-1.5 text-right transition-colors hover:bg-secondary/50 sm:min-h-28 sm:p-2',
                    isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/40',
                  )}
                >
                  <div className="flex items-center justify-end">
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full text-sm font-medium',
                        isToday
                          ? 'bg-primary font-bold text-primary-foreground'
                          : 'text-foreground',
                      )}
                    >
                      {cell.day}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <span
                        key={ev.id}
                        className={cn(
                          'truncate rounded-md px-1.5 py-0.5 text-right text-[11px] font-medium leading-tight',
                          getScheduleTypeStyle(ev.type).chip,
                        )}
                      >
                        <span className="hidden sm:inline">{ev.title}</span>
                        <span className="sm:hidden">●</span>
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="px-1 text-[10px] font-medium text-muted-foreground">
                        +{dayEvents.length - 2} أخرى
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        {/* اللوحة الجانبية */}
        <div className="relative">
        <div className="flex flex-col gap-6 xl:absolute xl:inset-0">
          {/* اليوم المحدد */}
          <Card className="shrink-0 gap-0 p-5">
            <h3 className="text-base font-bold text-foreground">
              {selectedDate ? formatDateLabel(selectedDate) : 'اختر يومًا'}
            </h3>

            <div className="mt-4 space-y-2.5">
              {!selectedDate && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  اضغط على أي يوم في الجدول لعرض مواعيده
                </p>
              )}
              {selectedDate && selectedEvents.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  لا توجد مواعيد في هذا اليوم
                </p>
              )}
              {selectedEvents.map((ev) => (
                <EventRow key={ev.id} event={ev} />
              ))}
            </div>
          </Card>

          {/* الأحداث القادمة */}
          <Card className="flex min-h-0 flex-1 flex-col gap-0 p-5">
            <h3 className="shrink-0 text-base font-bold text-foreground">المواعيد القادمة</h3>
            <div className="mt-4 max-h-[360px] min-h-0 flex-1 space-y-2.5 overflow-y-auto pl-1 xl:max-h-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {upcoming.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  لا توجد مواعيد قادمة
                </p>
              )}
              {upcoming.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    const [y, m] = ev.date.split('-').map(Number)
                    setCurrent(new Date(y, m - 1, 1))
                    setSelectedDate(ev.date)
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border border-border border-r-4 bg-secondary/40 p-3 text-right transition-colors hover:bg-secondary',
                    getScheduleTypeStyle(ev.type).bar,
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {ev.title}
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {ev.time}
                      </span>
                      <span>{formatDateLabel(ev.date)}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold',
                      getScheduleTypeStyle(ev.type).chip,
                    )}
                  >
                    {ev.type}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
        </div>
      </div>
    </div>
  )
}

function EventRow({ event }: { event: ScheduleEvent }) {
  const Icon = typeIcons[event.type] ?? CalendarDays
  return (
    <div
      className={cn(
        'rounded-xl border border-border border-r-4 bg-secondary/40 p-3',
        getScheduleTypeStyle(event.type).bar,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold',
            getScheduleTypeStyle(event.type).chip,
          )}
        >
          <Icon className="size-3" />
          {event.type}
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-sm font-semibold text-foreground">{event.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{event.course}</p>
        </div>
      </div>
      {event.description && (
        <p className="mt-2 text-right text-xs leading-relaxed text-muted-foreground">
          {event.description}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {event.time}
        </span>
      </div>
    </div>
  )
}
