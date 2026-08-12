'use client'

import { useState, useMemo, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Search, Inbox, ClipboardCheck, Hourglass, Loader2, Paperclip } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { useCanManage } from '@/components/dashboard/permissions-context'
import {
  gradeAssignmentSubmission,
  type AssignmentSubmissionDetail,
} from '@/app/admin/assignments/actions'

const ITEMS_PER_PAGE = 10

const fieldCls =
  'w-full rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card'

export function AssignmentSubmissionsTable({
  submissions,
  assignmentCode,
  maxPoints,
}: {
  submissions: AssignmentSubmissionDetail[]
  assignmentCode: string
  maxPoints: number
}) {
  const router = useRouter()
  const canManage = useCanManage('courses')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [gradingFor, setGradingFor] = useState<AssignmentSubmissionDetail | null>(null)
  const [scoreInput, setScoreInput] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setPage(1)
  }, [query])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return submissions
    return submissions.filter(
      (s) => s.studentName.toLowerCase().includes(q) || s.studentCode.toLowerCase().includes(q),
    )
  }, [query, submissions])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  }, [filtered, page])

  const openGrading = (sub: AssignmentSubmissionDetail) => {
    setGradingFor(sub)
    setScoreInput(sub.score != null ? String(sub.score) : '')
  }

  const handleSaveGrade = () => {
    if (!gradingFor) return
    const score = Number(scoreInput)
    if (Number.isNaN(score) || score < 0) {
      toast.error('أدخل درجة صحيحة')
      return
    }
    startTransition(async () => {
      const result = await gradeAssignmentSubmission(gradingFor.id, score)
      if (!result.success) {
        toast.error(result.error ?? 'تعذّر حفظ الدرجة')
        return
      }
      toast.success('تم حفظ درجة الطالب بنجاح')
      setGradingFor(null)
      router.refresh()
    })
  }

  if (submissions.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed font-sans">
        <Inbox className="size-8 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium font-sans">لا توجد تسليمات</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          لم يقم أي طالب بتسليم هذا الواجب حتى الآن. ستظهر تسليمات الطلاب هنا فور تقديمها.
        </p>
      </Card>
    )
  }

  return (
    <>
      <Card className="font-sans">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-sans">تسليمات الطلاب</CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم الطالب أو الكود..."
              className="pl-4 pr-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-y bg-muted/50 text-muted-foreground">
                  <th className="px-6 py-3 font-medium">اسم الطالب</th>
                  <th className="px-6 py-3 font-medium">كود الطالب</th>
                  <th className="px-6 py-3 font-medium">تاريخ التسليم</th>
                  <th className="px-6 py-3 font-medium">المرفق</th>
                  <th className="px-6 py-3 font-medium">الدرجة</th>
                  <th className="px-6 py-3 font-medium">الحالة</th>
                  {canManage && <th className="px-6 py-3 font-medium">التصحيح</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map((sub) => {
                  const pending = sub.status === 'تم التسليم'
                  const graded = sub.status === 'مصحّح'

                  return (
                    <tr key={sub.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">{sub.studentName}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-muted-foreground">{sub.studentCode}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {sub.submittedAt ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        {sub.attachmentUrl ? (
                          <a
                            href={sub.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Paperclip className="size-3.5" />
                            عرض الملف
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {graded ? (
                          <div className="flex items-baseline gap-1">
                            <span className="font-semibold">{sub.score}</span>
                            <span className="text-muted-foreground text-xs">/ {maxPoints}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {pending ? (
                          <Badge variant="secondary" className="gap-1 shadow-none">
                            <Hourglass className="size-3" />
                            بانتظار التصحيح
                          </Badge>
                        ) : graded ? (
                          <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20 shadow-none">
                            مصحّح
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="shadow-none">
                            {sub.status}
                          </Badge>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-6 py-4">
                          <Button
                            size="sm"
                            variant={pending ? 'default' : 'outline'}
                            onClick={() => openGrading(sub)}
                          >
                            <ClipboardCheck className="size-4" />
                            {pending ? 'تصحيح' : 'مراجعة'}
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 7 : 6} className="py-12 text-center text-muted-foreground">
                      لا توجد نتائج تطابق بحثك.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        {filtered.length > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </Card>

      <Modal
        open={!!gradingFor}
        onClose={() => setGradingFor(null)}
        title="تصحيح الواجب"
        description={gradingFor ? `الطالب: ${gradingFor.studentName}` : undefined}
      >
        <div className="space-y-4 text-right">
          {gradingFor?.attachmentUrl && (
            <a
              href={gradingFor.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Paperclip className="size-4" />
              عرض ملف التسليم
            </a>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              الدرجة (من {maxPoints})
            </span>
            <input
              type="number"
              min={0}
              max={maxPoints || undefined}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              className={fieldCls}
              dir="ltr"
              placeholder="0"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setGradingFor(null)} disabled={isPending}>
              إلغاء
            </Button>
            <Button onClick={handleSaveGrade} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
              حفظ الدرجة
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
