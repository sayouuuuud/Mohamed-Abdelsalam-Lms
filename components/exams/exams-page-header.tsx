'use client'

import Link from 'next/link'
import { FilePlus2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportToCsv } from '@/lib/export-csv'
import type { ExamRecord } from '@/lib/exams-data'
import { useCanManage } from '@/components/dashboard/permissions-context'

export function ExamsPageHeader({ exams }: { exams: ExamRecord[] }) {
  const canManage = useCanManage('exams')
  const exportData = () => {
    if (exams.length === 0) {
      toast.error('لا توجد بيانات اختبارات للتصدير')
      return
    }
    exportToCsv(
      'exams.csv',
      exams.map((exam) => ({
        'رقم الاختبار': exam.id,
        'عنوان الاختبار': exam.title,
        الكورس: exam.course,
        'عدد الأسئلة': exam.questions,
        'المدة (دقيقة)': exam.duration,
        'عدد المشاركين': exam.participants,
        'متوسط الدرجات': exam.avgScore,
        الحالة: exam.status,
        'تاريخ الإنشاء': exam.createdAt,
      })),
    )
    toast.success('تم تصدير بيانات الاختبارات')
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">الاختبارات</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          إنشاء ومتابعة جميع الاختبارات والكويزات على المنصة
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
          <Button nativeButton={false} render={<Link href="/admin/exams/create" />}>
            <FilePlus2 className="size-4" />
            إنشاء اختبار
          </Button>
        )}
      </div>
    </div>
  )
}
