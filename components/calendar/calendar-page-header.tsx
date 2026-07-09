'use client'

import { CalendarPlus, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportToCsv } from '@/lib/export-csv'
import { useCalendar } from './calendar-context'
import { useCanManage } from '@/components/dashboard/permissions-context'

export function CalendarPageHeader() {
  const { events, openCreate } = useCalendar()
  const canManage = useCanManage('calendar')

  const exportData = () => {
    if (events.length === 0) {
      toast.error('لا توجد أحداث للتصدير')
      return
    }
    exportToCsv(
      'calendar-events.csv',
      [...events]
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .map((event) => ({
          العنوان: event.title,
          النوع: event.type,
          التاريخ: event.date,
          الوقت: event.time,
          الكورس: event.course ?? '-',
          الوصف: event.description ?? '-',
        })),
    )
    toast.success('تم تصدير أحداث التقويم')
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">التقويم</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          تابع مواعيد المحاضرات والاختبارات وأضف أحداثك الخاصة
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-border bg-card text-foreground hover:bg-secondary"
          onClick={exportData}
        >
          <Download className="size-4" />
          تصدير البيانات
        </Button>
        {canManage && (
          <Button onClick={() => openCreate()}>
            <CalendarPlus className="size-4" />
            إضافة حدث
          </Button>
        )}
      </div>
    </div>
  )
}
