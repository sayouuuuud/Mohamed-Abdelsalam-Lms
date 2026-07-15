'use client'

import { useState } from 'react'
import { ArrowRight, Download, Trash2, Pencil, Calendar, Clock, BookOpen, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { exportToCsv } from '@/lib/export-csv'
import { updateExam } from '@/app/admin/exams/[id]/actions'

const fieldCls =
  'w-full rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card'

type ExamHeaderProps = {
  code: string
  title: string
  status: string
  course?: string
  duration?: number
  createdAt?: string
  description?: string
  passMark?: number
  // Submissions data for CSV export
  submissions?: Array<{
    studentName: string
    studentCode: string
    score: number
    total: number
    status: string
    submittedAt: string
  }>
}

export function ExamDetailsHeader({ exam }: { exam: ExamHeaderProps }) {
  const router = useRouter()
  const isPublished = exam.status === 'منشور'

  // ── Edit modal state ──────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState(exam.title)
  const [editCourse, setEditCourse] = useState(exam.course ?? '')
  const [editDescription, setEditDescription] = useState(exam.description ?? '')
  const [editDuration, setEditDuration] = useState(exam.duration ?? 45)
  const [editPassMark, setEditPassMark] = useState(exam.passMark ?? 50)
  const [editStatus, setEditStatus] = useState(exam.status)

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      toast.error('عنوان الاختبار مطلوب')
      return
    }
    setSaving(true)
    try {
      const result = await updateExam(exam.code, {
        title: editTitle,
        course: editCourse,
        description: editDescription,
        duration: editDuration,
        passMark: editPassMark,
        status: editStatus,
      })
      if (!result.success) {
        toast.error(result.error ?? 'تعذّر حفظ التعديلات')
        return
      }
      toast.success('تم حفظ التعديلات بنجاح')
      setEditOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // ── Export submissions to CSV ─────────────────────────────────
  const handleExport = () => {
    const subs = exam.submissions ?? []
    if (subs.length === 0) {
      toast.error('لا توجد إجابات لتصديرها بعد')
      return
    }
    exportToCsv(`exam-${exam.code}-submissions.csv`, subs.map((s) => ({
      'اسم الطالب': s.studentName,
      'رقم الطالب': s.studentCode,
      'الدرجة': s.score,
      'من': s.total,
      'النتيجة': `${s.total > 0 ? Math.round((s.score / s.total) * 100) : 0}%`,
      'الحالة': s.status,
      'تاريخ التسليم': s.submittedAt,
    })))
    toast.success('تم تصدير نتائج الاختبار')
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/exams')}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="size-5" />
          </Button>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{exam.title}</h1>
              <Badge
                variant={isPublished ? 'default' : 'secondary'}
                className={cn(
                  'font-normal text-xs rounded-md',
                  isPublished ? 'bg-success/15 text-success hover:bg-success/20 shadow-none' : ''
                )}
              >
                {exam.status}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5 font-mono">
                <span>{exam.code}</span>
              </div>

              {exam.course && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30 mx-1" />
                  <BookOpen className="size-3.5" />
                  <span>{exam.course}</span>
                </div>
              )}

              {exam.duration && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30 mx-1" />
                  <Clock className="size-3.5" />
                  <span>{exam.duration} دقيقة</span>
                </div>
              )}

              {exam.createdAt && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30 mx-1" />
                  <Calendar className="size-3.5" />
                  <span>{exam.createdAt}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex"
            onClick={handleExport}
          >
            <Download className="mr-2 size-4" />
            تصدير التقرير
          </Button>
          <Button variant="default" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            تعديل
          </Button>
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="تعديل الاختبار"
        description="عدّل بيانات الاختبار ثم احفظ التغييرات"
      >
        <div className="space-y-4 text-right">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">عنوان الاختبار</span>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className={fieldCls}
              placeholder="عنوان الاختبار"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">الكورس</span>
            <input
              value={editCourse}
              onChange={(e) => setEditCourse(e.target.value)}
              className={fieldCls}
              placeholder="اسم الكورس"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">المدة (دقيقة)</span>
              <input
                type="number"
                min={1}
                value={editDuration}
                onChange={(e) => setEditDuration(Number(e.target.value) || 1)}
                className={fieldCls}
                dir="ltr"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">درجة النجاح (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={editPassMark}
                onChange={(e) => setEditPassMark(Number(e.target.value) || 0)}
                className={fieldCls}
                dir="ltr"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">الوصف (اختياري)</span>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className={cn(fieldCls, 'resize-none leading-relaxed')}
              placeholder="تعليمات أو ملاحظات"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">الحالة</span>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className={fieldCls}
            >
              <option value="منشور">منشور</option>
              <option value="مسودة">مسودة</option>
              <option value="منتهي">منتهي</option>
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              حفظ التعديلات
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
