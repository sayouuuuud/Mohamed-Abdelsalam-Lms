'use client'

import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportToCsv } from '@/lib/export-csv'
import type { AssignmentOverview } from '@/app/admin/assignments/actions'

export function AssignmentsPageHeader({ assignments }: { assignments: AssignmentOverview[] }) {
  const exportData = () => {
    if (assignments.length === 0) {
      toast.error('لا توجد بيانات واجبات للتصدير')
      return
    }
    exportToCsv(
      'assignments.csv',
      assignments.map((a) => ({
        'رقم الواجب': a.code,
        'عنوان الواجب': a.title,
        المحاضرة: a.courseTitle,
        النوع: a.type,
        'عدد التسليمات': a.submittedCount,
        'بانتظار التصحيح': a.pendingCount,
        'متوسط الدرجات': a.avgScore,
        'تاريخ التسليم النهائي': a.dueDate ?? '—',
        'تاريخ الإنشاء': a.createdAt,
      })),
    )
    toast.success('تم تصدير بيانات الواجبات')
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">الواجبات</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          متابعة تسليمات الطلاب على جميع الواجبات وتصحيحها
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
      </div>
    </div>
  )
}
