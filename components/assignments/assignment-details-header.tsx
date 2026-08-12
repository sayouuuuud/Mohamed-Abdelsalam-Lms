'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Download, Calendar, BookOpen, Award } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { exportToCsv } from '@/lib/export-csv'
import type { AssignmentDetailsData } from '@/app/admin/assignments/actions'

export function AssignmentDetailsHeader({ assignment }: { assignment: AssignmentDetailsData }) {
  const router = useRouter()

  const handleExport = () => {
    if (assignment.submissions.length === 0) {
      toast.error('لا توجد تسليمات لتصديرها بعد')
      return
    }
    exportToCsv(
      `assignment-${assignment.code}-submissions.csv`,
      assignment.submissions.map((s) => ({
        'اسم الطالب': s.studentName,
        'رقم الطالب': s.studentCode,
        الدرجة: s.score ?? '—',
        من: assignment.points,
        الحالة: s.status,
        'تاريخ التسليم': s.submittedAt ?? '—',
      })),
    )
    toast.success('تم تصدير تسليمات الواجب')
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/assignments')}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-5" />
        </Button>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{assignment.title}</h1>
            <Badge variant="secondary" className="font-normal text-xs rounded-md shadow-none">
              {assignment.type}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 font-mono">
              <span>{assignment.code}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30 mx-1" />
              <BookOpen className="size-3.5" />
              <span>{assignment.courseTitle}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30 mx-1" />
              <Award className="size-3.5" />
              <span>{assignment.points} نقطة</span>
            </div>

            {assignment.dueDate && (
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30 mx-1" />
                <Calendar className="size-3.5" />
                <span>موعد التسليم: {assignment.dueDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 size-4" />
          تصدير التسليمات
        </Button>
      </div>
    </div>
  )
}
