'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ListChecks, Loader2, Plus, Save, Send } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import {
  createQuestion,
  questionTypeMeta,
  type ExamMeta,
  type Question,
  type QuestionType,
} from '@/lib/exam-builder'
import { saveExam, type StageWithBranches } from '@/app/admin/exams/actions'
import { QuestionCard } from './question-card'
import { QuestionTypePicker } from './question-type-picker'

const fieldCls =
  'w-full rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card'

export function ExamBuilder({ stages = [] }: { stages?: StageWithBranches[] }) {
  const [meta, setMeta] = useState<ExamMeta>({
    title: '',
    course: '',
    description: '',
    duration: 45,
    passMark: 50,
    shuffle: false,
    stageId: null,
    branchId: null,
  })
  const [questions, setQuestions] = useState<Question[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const updateMeta = (patch: Partial<ExamMeta>) => setMeta((m) => ({ ...m, ...patch }))

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (q.points || 0), 0),
    [questions],
  )

  const addQuestion = (type: QuestionType) => {
    setQuestions((qs) => [...qs, createQuestion(type)])
    setPickerOpen(false)
  }

  const updateQuestion = (q: Question) =>
    setQuestions((qs) => qs.map((item) => (item.id === q.id ? q : item)))

  const removeQuestion = (id: string) =>
    setQuestions((qs) => qs.filter((item) => item.id !== id))

  const validate = () => {
    if (!meta.title.trim()) {
      toast.error('أدخل عنوان الاختبار')
      return false
    }
    if (questions.length === 0) {
      toast.error('أضف سؤالًا واحدًا على الأقل')
      return false
    }
    const emptyTextQ = questions.find(
      (q) => q.contentMode === 'text' && !q.text.trim(),
    )
    if (emptyTextQ) {
      toast.error('هناك سؤال بدون نص')
      return false
    }
    const emptyImageQ = questions.find(
      (q) => q.contentMode === 'image' && !q.imageUrl.trim(),
    )
    if (emptyImageQ) {
      toast.error('هناك سؤال مصوّر بدون صورة مرفوعة')
      return false
    }
    const badMcq = questions.find(
      (q) => q.type === 'mcq' && q.options.some((o) => !o.text.trim()),
    )
    if (badMcq) {
      toast.error('هناك خيار فارغ في أحد أسئلة الاختيار من متعدد')
      return false
    }
    return true
  }

  const handleSave = async (publish: boolean) => {
    if (!validate()) return
    setSaving(true)
    try {
      const result = await saveExam({
        meta: { ...meta },
        questions: questions.map((q) => ({
          type: q.type,
          contentMode: q.contentMode,
          text: q.text,
          imageUrl: q.imageUrl,
          points: q.points,
          options: q.options,
          correctOptionId: q.correctOptionId,
          modelAnswer: q.modelAnswer,
        })),
        publish,
      })
      if (!result.success) {
        toast.error(result.error || 'تعذر حفظ الاختبار')
        return
      }
      toast.success(publish ? 'تم نشر الاختبار بنجاح' : 'تم حفظ الاختبار كمسودة')
      router.push('/admin/exams')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main column */}
      <div className="space-y-6">
        {/* Exam settings */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-right text-base font-bold text-foreground">تفاصيل الاختبار</h3>
          <div className="mt-4 grid gap-4 text-right">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                عنوان الاختبار
              </span>
              <input
                value={meta.title}
                onChange={(e) => updateMeta({ title: e.target.value })}
                placeholder="مثال: اختبار منتصف الفصل - مقدمة في البرمجة"
                className={fieldCls}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">الكورس</span>
                <input
                  value={meta.course}
                  onChange={(e) => updateMeta({ course: e.target.value })}
                  placeholder="اسم الكورس"
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  المدة (دقيقة)
                </span>
                <input
                  type="number"
                  min={1}
                  value={meta.duration}
                  onChange={(e) => updateMeta({ duration: Number(e.target.value) || 0 })}
                  className={fieldCls}
                  dir="ltr"
                />
              </label>
            </div>

            {stages.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">
                    السنة الدراسية (اختياري)
                  </span>
                  <select
                    value={meta.stageId ?? ''}
                    onChange={(e) => {
                      const stageId = e.target.value || null
                      // Clear branch when stage changes so there's no orphan selection.
                      updateMeta({ stageId, branchId: null })
                    }}
                    className={fieldCls}
                  >
                    <option value="">كل السنوات</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.title}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1.5 block text-xs text-muted-foreground">
                    يظهر الاختبار لطلاب هذه السنة فقط.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">
                    الفرع (اختياري)
                  </span>
                  <select
                    value={meta.branchId ?? ''}
                    onChange={(e) => updateMeta({ branchId: e.target.value || null })}
                    className={fieldCls}
                    disabled={!meta.stageId}
                  >
                    <option value="">كل الفروع</option>
                    {stages
                      .find((s) => s.id === meta.stageId)
                      ?.branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.title}
                        </option>
                      ))}
                  </select>
                  <span className="mt-1.5 block text-xs text-muted-foreground">
                    {meta.stageId
                      ? 'يضيّق الاختبار على فرع محدد داخل السنة.'
                      : 'اختر سنة أولاً لتحديد الفرع.'}
                  </span>
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                وصف الاختبار (اختياري)
              </span>
              <textarea
                value={meta.description}
                onChange={(e) => updateMeta({ description: e.target.value })}
                placeholder="تعليمات أو ملاحظات تظهر للطالب قبل بدء الاختبار"
                rows={2}
                className={cn(fieldCls, 'resize-none leading-relaxed')}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  درجة النجاح (%)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={meta.passMark}
                  onChange={(e) => updateMeta({ passMark: Number(e.target.value) || 0 })}
                  className={fieldCls}
                  dir="ltr"
                />
              </label>
              <label className="flex items-end pb-1">
                <span className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={meta.shuffle}
                    onChange={(e) => updateMeta({ shuffle: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  ترتيب عشوائي للأسئلة
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">
              الأسئلة
              <span className="mr-2 text-sm font-normal text-muted-foreground">
                ({questions.length})
              </span>
            </h3>
            <Button type="button" onClick={() => setPickerOpen(true)}>
              <Plus className="size-4" />
              إضافة سؤال
            </Button>
          </div>

          {questions.length === 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 p-10 text-center transition-colors hover:border-primary hover:bg-card"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ListChecks className="size-6" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                لم تتم إ��افة أي أسئلة بعد
              </span>
              <span className="text-xs text-muted-foreground">
                ابدأ بإضافة سؤال اختيار من متعدد أو مقالي أو إرفاق ملف
              </span>
            </button>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i}
                  onChange={updateQuestion}
                  onRemove={() => removeQuestion(q.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sidebar summary */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-right text-base font-bold text-foreground">ملخص الاختبار</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryRow label="عدد الأسئلة" value={String(questions.length)} />
            <SummaryRow label="مجموع الدرجات" value={String(totalPoints)} />
            <SummaryRow label="المدة" value={`${meta.duration} دقيقة`} />
            <SummaryRow label="درجة النجاح" value={`${meta.passMark}%`} />
          </dl>

          <div className="mt-4 space-y-1.5 border-t border-border pt-4">
            {(Object.keys(questionTypeMeta) as Array<keyof typeof questionTypeMeta>).map(
              (type) => {
                const count = questions.filter((q) => q.type === type).length
                const meta = questionTypeMeta[type]
                const Icon = meta.icon
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between text-sm text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-4" />
                      {meta.label}
                    </span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                )
              },
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="button" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            نشر الاختبار
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ كمسودة
          </Button>
          <Link
            href="/admin/exams"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowRight className="size-4" />
            العودة للاختبارات
          </Link>
        </div>
      </aside>

      {/* Type picker modal */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="اختر نوع السؤال"
        description="حدّد نوع السؤال الذي تريد إضافته للاختبار"
      >
        <QuestionTypePicker onPick={addQuestion} />
      </Modal>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  )
}
