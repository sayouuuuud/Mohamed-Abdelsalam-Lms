'use client'

import { useEffect, useState } from 'react'
import { Modal, Field } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCoupons } from './coupons-context'
import { getCouponLectureIds } from '@/app/admin/coupons/actions'
import type { CouponStatus, CouponType, CouponScope } from '@/lib/coupons-data'

const types: CouponType[] = ['نسبة مئوية', 'مبلغ ثابت']
// "منتهي" حالة محسوبة من تاريخ الانتهاء تلقائياً، فالأدمن يختار نشط/متوقف فقط.
const statuses: CouponStatus[] = ['نشط', 'متوقف']

export function CouponFormModal() {
  const {
    formOpen,
    editing,
    lectures,
    closeForm,
    submitForm,
    deleting,
    closeDelete,
    confirmDelete,
  } = useCoupons()

  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CouponType>('نسبة مئوية')
  const [value, setValue] = useState('')
  const [limit, setLimit] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<CouponStatus>('نشط')
  const [scope, setScope] = useState<CouponScope>('all')
  const [lectureIds, setLectureIds] = useState<string[]>([])
  const [lectureQuery, setLectureQuery] = useState('')

  useEffect(() => {
    if (formOpen) {
      setCode(editing?.code ?? '')
      setDescription(editing?.description ?? '')
      setType(editing?.type ?? 'نسبة مئوية')
      setValue(editing ? String(editing.value) : '')
      setLimit(editing ? String(editing.limit) : '')
      setStartDate(editing?.startDate ?? '')
      setEndDate(editing?.endDate ?? '')
      // "منتهي" محسوبة، فنرجّعها لنيّة الأدمن الأصلية (نشط) عند التعديل.
      setStatus(editing?.status === 'متوقف' ? 'متوقف' : 'نشط')
      setScope(editing?.scope ?? 'all')
      setLectureQuery('')
      // Load the coupon's covered lectures when editing a lectures-scoped one.
      if (editing && editing.scope === 'lectures') {
        getCouponLectureIds(editing.id).then(setLectureIds)
      } else {
        setLectureIds([])
      }
    }
  }, [formOpen, editing])

  const toggleLecture = (id: string) =>
    setLectureIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    submitForm({
      code: code.trim().toUpperCase(),
      description: description.trim(),
      type,
      value: Number(value) || 0,
      limit: Number(limit) || 0,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || new Date().toISOString().slice(0, 10),
      status,
      scope,
      lectureIds: scope === 'lectures' ? lectureIds : [],
    })
  }

  const filteredLectures = lectures.filter(
    (l) =>
      !lectureQuery.trim() ||
      l.title.includes(lectureQuery) ||
      l.branch.includes(lectureQuery),
  )

  const inputCls =
    'h-11 w-full rounded-xl border border-border bg-secondary/60 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card'

  return (
    <>
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'تعديل الكوبون' : 'إنشاء كوبون جديد'}
        description="حدّد كود الخصم وقيمته وفترة صلاحيته"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="كود الكوبون">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="مثال: WELCOME25"
              className="font-mono uppercase"
              autoFocus
            />
          </Field>
          <Field label="الوصف">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر للعرض"
            />
          </Field>
          <Field label="نوع الخصم">
            <div className="flex gap-2">
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                    type === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={type === 'نسبة مئوية' ? 'النسبة (%)' : 'المبلغ (ج.م)'}>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <Field label="حد الاستخدام">
              <input
                type="number"
                min={0}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>
          </div>

          {/* نطاق الخصم: الكل أو محاضرات محددة */}
          <Field label="نطاق الخصم">
            <div className="flex gap-2">
              {(
                [
                  { v: 'all', label: 'كل السلة' },
                  { v: 'lectures', label: 'محاضرات محددة' },
                ] as { v: CouponScope; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setScope(opt.v)}
                  className={cn(
                    'flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                    scope === opt.v
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {scope === 'lectures' && (
            <Field
              label={`المحاضرات المشمولة${
                lectureIds.length ? ` (${lectureIds.length})` : ''
              }`}
            >
              <input
                value={lectureQuery}
                onChange={(e) => setLectureQuery(e.target.value)}
                placeholder="ابحث عن محاضرة..."
                className={`${inputCls} mb-2`}
              />
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-secondary/30 p-2">
                {filteredLectures.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    مفيش محاضرات مطابقة.
                  </p>
                ) : (
                  filteredLectures.map((l) => (
                    <label
                      key={l.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
                    >
                      <input
                        type="checkbox"
                        checked={lectureIds.includes(l.id)}
                        onChange={() => toggleLecture(l.id)}
                        className="size-4 accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {l.title}
                        </span>
                        {l.branch && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {l.branch}
                          </span>
                        )}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {scope === 'lectures' && lectureIds.length === 0 && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                  اختار محاضرة واحدة على الأقل عشان الكوبون يشتغل.
                </p>
              )}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="تاريخ البدء">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
                dir="ltr"
              />
            </Field>
            <Field label="تاريخ الانتهاء">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
                dir="ltr"
              />
            </Field>
          </div>
          <Field label="الحالة">
            <div className="flex gap-2">
              {statuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    'flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                    status === s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit">{editing ? 'حفظ التغييرات' : 'إنشاء الكوبون'}</Button>
            <Button type="button" variant="outline" onClick={closeForm}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        title="حذف الكوبون"
        description={`هل أنت متأكد من حذف الكوبون "${deleting?.code}"؟`}
      />
    </>
  )
}
