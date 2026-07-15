'use client'

import { useEffect, useState } from 'react'
import { Modal, Field } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageUploadField } from '@/components/ui/image-upload-field'
import { cn } from '@/lib/utils'
import { useCurriculum } from './curriculum-context'

const textareaClass =
  'w-full resize-none rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card'



export function CurriculumFormModals() {
  const {
    stages,
    stageFormOpen,
    editingStage,
    closeStageForm,
    submitStageForm,
    deletingStage,
    closeDeleteStage,
    confirmDeleteStage,
    branchFormOpen,
    editingBranch,
    closeBranchForm,
    submitBranchForm,
    deletingBranch,
    closeDeleteBranch,
    confirmDeleteBranch,
    courseFormOpen,
    editingCourse,
    courseBranchId,
    closeCourseForm,
    submitCourseForm,
    deletingCourse,
    closeDeleteCourse,
    confirmDeleteCourse,
    termFormOpen,
    editingTerm,
    termStageId,
    closeTermForm,
    submitTermForm,
    deletingTerm,
    closeDeleteTerm,
    confirmDeleteTerm,
  } = useCurriculum()

  // ── Stage form state ──
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [idx, setIdx] = useState('')
  const [rows, setRows] = useState('')
  const [stageImage, setStageImage] = useState('')
  const [termPrice, setTermPrice] = useState('')
  const [termOldPrice, setTermOldPrice] = useState('')

  useEffect(() => {
    if (stageFormOpen) {
      setTitle(editingStage?.title ?? '')
      setSubtitle(editingStage?.subtitle ?? '')
      setIdx(editingStage?.idx ?? '')
      setRows((editingStage?.rows ?? []).join('\n'))
      setStageImage(editingStage?.image ?? '')
      setTermPrice(editingStage?.termPrice ? String(editingStage.termPrice) : '')
      setTermOldPrice(editingStage?.termOldPrice ? String(editingStage.termOldPrice) : '')
    }
  }, [stageFormOpen, editingStage])

  const handleStageSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    submitStageForm({
      title: title.trim(),
      subtitle: subtitle.trim(),
      idx: idx.trim(),
      rows: rows.split('\n').map((r) => r.trim()).filter(Boolean),
      image: stageImage,
      termPrice: Number(termPrice) || 0,
      termOldPrice: termOldPrice.trim() ? Number(termOldPrice) : null,
    })
  }

  // ── Branch form state ──
  const [bTitle, setBTitle] = useState('')
  const [bDescription, setBDescription] = useState('')
  const [bTopics, setBTopics] = useState('')
  const [bImage, setBImage] = useState('')

  useEffect(() => {
    if (branchFormOpen) {
      setBTitle(editingBranch?.title ?? '')
      setBDescription(editingBranch?.description ?? '')
      setBTopics((editingBranch?.topics ?? []).join('\n'))
      setBImage(editingBranch?.image ?? '')
    }
  }, [branchFormOpen, editingBranch])

  const handleBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bTitle.trim()) return
    submitBranchForm({
      title: bTitle.trim(),
      description: bDescription.trim(),
      topics: bTopics.split('\n').map((t) => t.trim()).filter(Boolean),
      image: bImage,
    })
  }

  // ── Course form state ──
  const [cTitle, setCTitle] = useState('')
  const [cDescription, setCDescription] = useState('')
  const [cImage, setCImage] = useState('')
  const [cPrice, setCPrice] = useState('')
  const [cOldPrice, setCOldPrice] = useState('')
  const [cBadge, setCBadge] = useState('')
  const [cPublished, setCPublished] = useState(false)
  const [cBranchId, setCBranchId] = useState('')
  const [cIsFree, setCIsFree] = useState(false)
  const [cTermId, setCTermId] = useState<string>('')

  // Terms available for the branch's parent stage.
  const courseStageTerms = (() => {
    const branchId = courseBranchId || cBranchId
    if (!branchId) return []
    for (const stage of stages) {
      if (stage.branches.some((b) => b.id === branchId)) return stage.terms ?? []
    }
    return []
  })()

  useEffect(() => {
    if (courseFormOpen) {
      setCTitle(editingCourse?.title ?? '')
      setCDescription(editingCourse?.description ?? '')
      setCImage(editingCourse?.image ?? '')
      const isFree = editingCourse ? editingCourse.price === 0 : false
      setCIsFree(isFree)
      setCPrice(isFree ? '0' : (editingCourse ? String(editingCourse.price) : ''))
      setCOldPrice(editingCourse?.oldPrice != null ? String(editingCourse.oldPrice) : '')
      setCBadge(editingCourse?.badge ?? '')
      setCPublished(editingCourse?.isPublished ?? false)
      setCBranchId(courseBranchId || (stages[0]?.branches[0]?.id ?? ''))
      setCTermId(editingCourse?.termId ?? '')
    }
  }, [courseFormOpen, editingCourse, courseBranchId, stages])

  const handleCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cTitle.trim()) return
    submitCourseForm({
      title: cTitle.trim(),
      description: cDescription.trim(),
      image: cImage,
      price: cIsFree ? 0 : (Number(cPrice) || 0),
      oldPrice: cOldPrice.trim() ? Number(cOldPrice) : null,
      badge: cBadge.trim(),
      isPublished: cPublished,
      branchId: courseBranchId || cBranchId,
      termId: cTermId || null,
    })
  }

  // ── Term form state ──
  const [tTitle, setTTitle] = useState('')
  const [tPrice, setTPrice] = useState('')
  const [tOldPrice, setTOldPrice] = useState('')

  useEffect(() => {
    if (termFormOpen) {
      setTTitle(editingTerm?.title ?? '')
      setTPrice(editingTerm?.price ? String(editingTerm.price) : '')
      setTOldPrice(editingTerm?.oldPrice ? String(editingTerm.oldPrice) : '')
    }
  }, [termFormOpen, editingTerm])

  const handleTermSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tTitle.trim()) return
    submitTermForm({
      title: tTitle.trim(),
      price: Number(tPrice) || 0,
      oldPrice: tOldPrice.trim() ? Number(tOldPrice) : null,
    })
  }

  return (
    <>
      {/* Stage form */}
      <Modal
        open={stageFormOpen}
        onClose={closeStageForm}
        title={editingStage ? 'تعديل التصنيف الرئيسي' : 'إضافة تصنيف رئيسي جديد'}
        description="بيانات التصنيف الرئيسي (السنة الدراسية) كما تظهر للطلاب"
      >
        <form onSubmit={handleStageSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="اسم التصنيف (مثل: الصف الأول الثانوي)">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: الصف الأول الثانوي"
                  autoFocus
                />
              </Field>
            </div>
            <Field label="الترتيب (رقم)">
              <Input
                value={idx}
                onChange={(e) => setIdx(e.target.value)}
                placeholder="٠١"
              />
            </Field>
          </div>

          <Field label="الوصف المختصر">
            <textarea
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="نبذة قصيرة"
              rows={2}
              className={textareaClass}
            />
          </Field>

          <Field label="المحاور (كل محور في سطر)">
            <textarea
              value={rows}
              onChange={(e) => setRows(e.target.value)}
              placeholder={'الجبر والمتطابقات\nحساب المثلثات\nالهندسة التحليلية'}
              rows={3}
              className={textareaClass}
            />
          </Field>



          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="سعر الترم كامل (ج.م)">
              <Input
                type="number"
                inputMode="numeric"
                value={termPrice}
                onChange={(e) => setTermPrice(e.target.value)}
                placeholder="مثال: 1500"
              />
            </Field>
            <Field label="السعر قبل الخصم (اختياري)">
              <Input
                type="number"
                inputMode="numeric"
                value={termOldPrice}
                onChange={(e) => setTermOldPrice(e.target.value)}
                placeholder="مثال: 2000"
              />
            </Field>
          </div>

          <ImageUploadField
            label="صورة التصنيف"
            value={stageImage}
            onChange={setStageImage}
            hint="تظهر للطلاب على كارت التصنيف الرئيسي."
          />

          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit">
              {editingStage ? 'حفظ التغييرات' : 'إضافة التصنيف'}
            </Button>
            <Button type="button" variant="outline" onClick={closeStageForm}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      {/* Branch form */}
      <Modal
        open={branchFormOpen}
        onClose={closeBranchForm}
        title={editingBranch ? 'تعديل التصنيف الفرعي' : 'إضافة تصنيف فرعي جديد'}
        description="التصنيف الفرعي بيجمع مجموعة محاضرات داخله"
      >
        <form onSubmit={handleBranchSubmit} className="space-y-4">
          <Field label="اسم التصنيف الفرعي">
            <Input
              value={bTitle}
              onChange={(e) => setBTitle(e.target.value)}
              placeholder="مثال: الجبر والمتطابقات"
              autoFocus
            />
          </Field>
          <Field label="الوصف">
            <textarea
              value={bDescription}
              onChange={(e) => setBDescription(e.target.value)}
              placeholder="وصف مختصر للتصنيف الفرعي"
              rows={2}
              className={textareaClass}
            />
          </Field>
          <Field label="الموضوعات (كل موضوع في سطر)">
            <textarea
              value={bTopics}
              onChange={(e) => setBTopics(e.target.value)}
              placeholder={'الأعداد المركّبة\nالمتطابقات الشهيرة\nالمعادلات والمتباينات'}
              rows={3}
              className={textareaClass}
            />
          </Field>
          <ImageUploadField
            label="صورة التصنيف الفرعي"
            value={bImage}
            onChange={setBImage}
            hint="تظهر للطلاب على كارت التصنيف الفرعي."
          />
          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit">
              {editingBranch ? 'حفظ التغييرات' : 'إضافة التصنيف الفرعي'}
            </Button>
            <Button type="button" variant="outline" onClick={closeBranchForm}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      {/* Course form */}
      <Modal
        open={courseFormOpen}
        onClose={closeCourseForm}
        title={editingCourse ? 'تعديل الكورس' : 'إضافة كورس جديد'}
        description="الكورس (الشهر) بيجمع محاضرات الفرع بالترتيب ويقدر الطالب يشتريه كامل"
      >
        <form onSubmit={handleCourseSubmit} className="space-y-4">
          {!editingCourse && !courseBranchId && (
            <Field label="الفرع (المادة)">
              <select
                value={cBranchId}
                onChange={(e) => setCBranchId(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:bg-card"
              >
                {stages.map((stage) => (
                  <optgroup key={stage.id} label={stage.title}>
                    {stage.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          )}
          <Field label="اسم الكورس (مثل: كورس شهر أكتوبر)">
            <Input
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
              placeholder="مثال: كورس الشهر الأول"
              autoFocus
            />
          </Field>
          <Field label="الوصف">
            <textarea
              value={cDescription}
              onChange={(e) => setCDescription(e.target.value)}
              placeholder="وصف مختصر لمحتوى الكورس"
              rows={2}
              className={textareaClass}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={cIsFree}
              onChange={(e) => setCIsFree(e.target.checked)}
              className="size-4 rounded border-border"
            />
            كورس مجاني بالكامل
          </label>
          {!cIsFree && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="السعر (ج.م)">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={cPrice}
                  onChange={(e) => setCPrice(e.target.value)}
                  placeholder="٣٠٠"
                />
              </Field>
              <Field label="السعر قبل الخصم (اختياري)">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={cOldPrice}
                  onChange={(e) => setCOldPrice(e.target.value)}
                  placeholder="٤٥٠"
                />
              </Field>
            </div>
          )}
          {courseStageTerms.length > 0 && (
            <Field label="ينتمي لترم" hint="الطالب المشترك في الترم يوصل لهذا الكورس تلقائياً">
              <select
                value={cTermId}
                onChange={(e) => setCTermId(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:bg-card"
              >
                <option value="">— بدون ترم —</option>
                {courseStageTerms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
            <Field label="الشارة (اختياري)">
              <Input
                value={cBadge}
                onChange={(e) => setCBadge(e.target.value)}
                placeholder="جديد / الأكثر طلبًا"
              />
            </Field>
          </div>
          <ImageUploadField
            label="صورة الكورس"
            value={cImage}
            onChange={setCImage}
            hint="تظهر للطلاب على كارت الكورس. لو فاضية هنستخدم صورة أول محاضرة."
          />
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={cPublished}
              onChange={(e) => setCPublished(e.target.checked)}
              className="size-4 rounded border-border"
            />
            منشور ويظهر للطلاب
          </label>
          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit">
              {editingCourse ? 'حفظ التغييرات' : 'إضافة الكورس'}
            </Button>
            <Button type="button" variant="outline" onClick={closeCourseForm}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      {/* Term form */}
      <Modal
        open={termFormOpen}
        onClose={closeTermForm}
        title={editingTerm ? 'تعديل الترم' : 'إضافة ترم جديد'}
        description="الترم يجمع كورسات المرحلة — الطالب المشترك يوصل لكل كورساته الحالية والقادمة"
      >
        <form onSubmit={handleTermSubmit} className="space-y-4">
          <Field label="اسم الترم (مثال: ترم أول، ترم تاني)">
            <Input
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              placeholder="مثال: ترم أول"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="سعر الترم (ج.م)">
              <Input
                type="number"
                inputMode="numeric"
                value={tPrice}
                onChange={(e) => setTPrice(e.target.value)}
                placeholder="مثال: 1500"
              />
            </Field>
            <Field label="السعر قبل الخصم (اختياري)">
              <Input
                type="number"
                inputMode="numeric"
                value={tOldPrice}
                onChange={(e) => setTOldPrice(e.target.value)}
                placeholder="مثال: 2000"
              />
            </Field>
          </div>
          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit">
              {editingTerm ? 'حفظ التغييرات' : 'إضافة الترم'}
            </Button>
            <Button type="button" variant="outline" onClick={closeTermForm}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmations */}
      <ConfirmDialog
        open={!!deletingStage}
        onClose={closeDeleteStage}
        onConfirm={confirmDeleteStage}
        title="حذف التصنيف الرئيسي"
        description={`هل أنت متأكد من حذف تصنيف "${deletingStage?.title}"؟ سيتم حذف كل التصنيفات الفرعية والمحاضرات التابعة له. لا يمكن التراجع.`}
      />
      <ConfirmDialog
        open={!!deletingBranch}
        onClose={closeDeleteBranch}
        onConfirm={confirmDeleteBranch}
        title="حذف التصنيف الفرعي"
        description={`هل أنت متأكد من حذف تصنيف "${deletingBranch?.title}"؟ سيتم حذف كل المحاضرات التابعة له. لا يمكن التراجع.`}
      />
      <ConfirmDialog
        open={!!deletingCourse}
        onClose={closeDeleteCourse}
        onConfirm={confirmDeleteCourse}
        title="حذف الكورس"
        description={`هل أنت متأكد من حذف كورس "${deletingCourse?.title}"؟ المحاضرات التابعة له مش هتتحذف، بس هيتفك ارتباطها بالكورس وترجع محاضرات مستقلة.`}
      />
      <ConfirmDialog
        open={!!deletingTerm}
        onClose={closeDeleteTerm}
        onConfirm={confirmDeleteTerm}
        title="حذف الترم"
        description={`هل أنت متأكد من حذف ترم "${deletingTerm?.title}"؟ الكورسات المرتبطة به مش هتتحذف، بس هيتفك ارتباطها بالترم. الطلاب المشتركين في الترم مش هيتأثروا.`}
      />
    </>
  )
}
