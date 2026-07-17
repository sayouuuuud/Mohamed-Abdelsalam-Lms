'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal, Field } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageUploadField } from '@/components/ui/image-upload-field'
import { AttachmentsUploadField } from '@/components/ui/attachments-upload-field'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { useLectures } from './lectures-context'
import { createMonthlyCourseQuick, type LessonAttachment } from '@/app/admin/courses/actions'

const textareaClass =
  'w-full resize-none rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card'

const selectClass =
  'w-full rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:bg-card'

export function LectureFormModals() {
  const {
    branchOptions,
    lectureFormOpen,
    editingLecture,
    closeLectureForm,
    submitLectureForm,
    deletingLecture,
    closeDeleteLecture,
    confirmDeleteLecture,
    lessonFormOpen,
    editingLesson,
    closeLessonForm,
    submitLessonForm,
    deletingLesson,
    closeDeleteLesson,
    confirmDeleteLesson,
  } = useLectures()

  const router = useRouter()

  // ── Lecture form state ──
  const [stageId, setStageId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [monthlyCourseId, setMonthlyCourseId] = useState('')
  const [courseSectionId, setCourseSectionId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [oldPrice, setOldPrice] = useState('')
  const [badge, setBadge] = useState('')
  const [image, setImage] = useState('')
  const [releaseDate, setReleaseDate] = useState('')
  const [isFree, setIsFree] = useState(false)

  // Inline "create a new course" state (keyed per branch so newly-created
  // courses show up immediately without waiting for a full data refresh).
  const [creatingCourse, setCreatingCourse] = useState(false)
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [savingCourse, setSavingCourse] = useState(false)
  const [extraCourses, setExtraCourses] = useState<
    Record<string, { id: string; title: string }[]>
  >({})

  // Unique stages derived from branch options
  const stages = useMemo(() => {
    const map = new Map<string, string>()
    for (const b of branchOptions) {
      if (!map.has(b.stageId)) map.set(b.stageId, b.stageTitle)
    }
    return Array.from(map, ([id, title]) => ({ id, title }))
  }, [branchOptions])

  // Branches filtered by selected stage
  const branchesForStage = useMemo(
    () => branchOptions.filter((b) => b.stageId === stageId),
    [branchOptions, stageId],
  )

  useEffect(() => {
    if (lectureFormOpen) {
      const initialBranch = editingLecture
        ? branchOptions.find((b) => b.id === editingLecture.branchId)
        : undefined
      setStageId(initialBranch?.stageId ?? '')
      setBranchId(editingLecture?.branchId ?? '')
      setMonthlyCourseId(editingLecture?.monthlyCourseId ?? '')
      setCourseSectionId(editingLecture?.courseSectionId ?? '')
      setTitle(editingLecture?.title ?? '')
      setDescription(editingLecture?.description ?? '')
      setPrice(editingLecture ? String(editingLecture.price) : '')
      setOldPrice(editingLecture?.oldPrice != null ? String(editingLecture.oldPrice) : '')
      setBadge(editingLecture?.badge ?? '')
      setImage(editingLecture?.image ?? '')
      setIsFree(editingLecture?.isFree ?? false)
      setWhatYouLearn(editingLecture?.whatYouLearn?.join('\n') ?? '')
      
      if (editingLecture?.releaseDate) {
        // convert ISO to YYYY-MM-DDTHH:mm
        const d = new Date(editingLecture.releaseDate)
        const tzOffset = d.getTimezoneOffset() * 60000
        const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
        setReleaseDate(localISOTime)
      } else {
        setReleaseDate('')
      }
      setCreatingCourse(false)
      setNewCourseTitle('')
    }
  }, [lectureFormOpen, editingLecture, branchOptions])

  // Courses for the selected branch = server data + any just-created inline.
  const coursesForBranch = useMemo(() => {
    const base = branchOptions.find((b) => b.id === branchId)?.monthlyCourses ?? []
    const extra = extraCourses[branchId] ?? []
    const seen = new Set(base.map((c) => c.id))
    return [...base, ...extra.filter((c) => !seen.has(c.id))]
  }, [branchOptions, branchId, extraCourses])

  // Sections belong to a course and are managed from the Categories → Courses
  // tab. Here we only offer the existing sections of the selected course.
  const sectionsForCourse = useMemo(() => {
    if (!monthlyCourseId) return []
    const course = branchOptions
      .find((b) => b.id === branchId)
      ?.monthlyCourses.find((c) => c.id === monthlyCourseId)
    return course?.sections ?? []
  }, [branchOptions, branchId, monthlyCourseId])

  const handleCourseChange = (value: string) => {
    setMonthlyCourseId(value)
    setCourseSectionId('') // section belongs to a specific course
  }

  const handleCreateCourse = async () => {
    const name = newCourseTitle.trim()
    if (!name || !branchId) return
    setSavingCourse(true)
    const res = await createMonthlyCourseQuick({ branchId, title: name })
    setSavingCourse(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setExtraCourses((prev) => ({
      ...prev,
      [branchId]: [...(prev[branchId] ?? []), { id: res.id, title: res.title }],
    }))
    setMonthlyCourseId(res.id)
    setCourseSectionId('')
    setCreatingCourse(false)
    setNewCourseTitle('')
    toast.success('تم إنشاء الكورس وربطه بالمحاضرة')
    router.refresh()
  }

  // Reset branch when stage changes to one that doesn't contain it
  const handleStageChange = (value: string) => {
    setStageId(value)
    const stillValid = branchOptions.some(
      (b) => b.stageId === value && b.id === branchId,
    )
    if (!stillValid) setBranchId('')
  }

  const handleLectureSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !branchId || !monthlyCourseId) return
    submitLectureForm({
      branchId,
      monthlyCourseId: monthlyCourseId || null,
      courseSectionId: monthlyCourseId ? courseSectionId || null : null,
      title: title.trim(),
      description: description.trim(),
      price: Number(price) || 0,
      oldPrice: oldPrice ? Number(oldPrice) : null,
      badge: badge.trim() || null,
      image: image || null,
      releaseDate: releaseDate || null,
      whatYouLearn: whatYouLearn.split('\n').map(s => s.trim()).filter(Boolean),
      isFree,
    })
  }

  // ── Lesson form state ──
  const [whatYouLearn, setWhatYouLearn] = useState('')
  const [lTitle, setLTitle] = useState('')
  const [lDuration, setLDuration] = useState('')
  const [lIsFree, setLIsFree] = useState(false)
  const [lAttachments, setLAttachments] = useState<LessonAttachment[]>([])

  useEffect(() => {
    if (lessonFormOpen) {
      setLTitle(editingLesson?.title ?? '')
      setLDuration(editingLesson?.duration ?? '')
      setLIsFree(editingLesson?.isFree ?? false)
      setLAttachments(editingLesson?.attachments ?? [])
    }
  }, [lessonFormOpen, editingLesson])

  const handleLessonSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!lTitle.trim()) return
    submitLessonForm({
      title: lTitle.trim(),
      duration: lDuration.trim(),
      isFree: lIsFree,
      // نوع محتوى الدرس مثبّت على "فيديو"
      contentType: 'فيديو',
      attachments: lAttachments,
    })
  }

  return (
    <>
      {/* Lecture form */}
      <Modal
        open={lectureFormOpen}
        onClose={closeLectureForm}
        title={editingLecture ? 'تعديل المحاضرة' : 'إضافة محاضرة جديدة'}
        description="اختر المرحلة والفرع اللي هتتحط فيهم المحاضرة"
      >
        <form onSubmit={handleLectureSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="المرحلة">
              <select
                value={stageId}
                onChange={(e) => handleStageChange(e.target.value)}
                className={selectClass}
              >
                <option value="">اختر المرحلة</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الفرع">
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!stageId}
                className={cn(selectClass, !stageId && 'opacity-50')}
              >
                <option value="">
                  {stageId ? 'اختر الفرع' : 'اختر المرحلة أولاً'}
                </option>
                {branchesForStage.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="الكورس / الشهر">
            {creatingCourse ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    placeholder="اسم الكورس (مثال: كورس شهر أكتوبر)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                        e.preventDefault()
                        handleCreateCourse()
                      }
                    }}
                    autoFocus
                  />
                  <Button type="button" onClick={handleCreateCourse} disabled={savingCourse || !newCourseTitle.trim()}>
                    {savingCourse ? 'جارٍ الحفظ...' : 'إنشاء'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setCreatingCourse(false)
                      setNewCourseTitle('')
                    }}
                    aria-label="إلغاء إنشاء الكورس"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  هيتعمل كورس جديد داخل الفرع المحدد وتتربط بيه المحاضرة تلقائ��ًا.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={monthlyCourseId}
                  onChange={(event) => handleCourseChange(event.target.value)}
                  disabled={!branchId}
                  className={cn(selectClass, !branchId && 'opacity-50')}
                >
                  <option value="" disabled>اختر الكورس / الشهر</option>
                  {coursesForBranch.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  disabled={!branchId}
                  onClick={() => setCreatingCourse(true)}
                >
                  <Plus className="size-4" />
                  كورس جديد
                </Button>
              </div>
            )}
          </Field>

          {/* Section inside the course — only relevant once a course is chosen. */}
          {monthlyCourseId && !creatingCourse && (
            <Field label="التصنيف داخل الكورس (اختياري)">
              <select
                value={courseSectionId}
                onChange={(event) => setCourseSectionId(event.target.value)}
                className={selectClass}
              >
                <option value="">بدون تصنيف</option>
                {sectionsForCourse.map((section) => (
                  <option key={section.id} value={section.id}>{section.title}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {sectionsForCourse.length === 0
                  ? 'مفيش تصنيفات في الكورس ده لسه — تقدر تضيفها من تاب الكورسات في التصنيفات.'
                  : 'التصنيف بيجمّع ويرتّب محاضرات الكورس (مثال: المراجعة النهائية).'}
              </p>
            </Field>
          )}

          <Field label="عنوان المحاضرة">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: الأعداد المركّبة"
              autoFocus
            />
          </Field>

          <Field label="الوصف">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="نبذة مختصرة عن المحاضرة"
              rows={2}
              className={textareaClass}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="السعر (ج)">
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="120"
              />
            </Field>
            <Field label="السعر قبل الخصم">
              <Input
                type="number"
                value={oldPrice}
                onChange={(e) => setOldPrice(e.target.value)}
                placeholder="اختياري"
              />
            </Field>
            <Field label="شارة (Badge)">
              <Input
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="الأكثر طلبًا"
              />
            </Field>
          </div>

          <ImageUploadField
            label="صورة المحاضرة"
            value={image}
            onChange={setImage}
            hint="لو مرفعتش صورة، هنستخدم الصورة الافتراضية للمحاضرة."
          />

          <Field label="موعد النزول وتفعيل المحاضرة (اختياري)">
            <input
              type="datetime-local"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              className={cn(selectClass, 'w-full')}
              dir="ltr"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              إذا حددت موعداً، سيظهر في التقويم وتصبح المحاضرة متاحة في هذا الموعد.
            </p>
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 transition-colors hover:bg-secondary/60">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">محاضرة مجانية</span>
              <span className="text-xs text-muted-foreground">
                المحاضرة تفضل تابعة للكورس، لكن أي زائر (حتى بدون تسجيل) يقدر يتفرج عليها ودروسها.
              </span>
            </span>
          </label>

          <Field label="ماذا ستتعلم (كل نقطة في سطر منفصل)">
            <textarea
              value={whatYouLearn}
              onChange={(e) => setWhatYouLearn(e.target.value)}
              placeholder="مثال:&#10;فهم المفاهيم الأساسية للموضوع&#10;تطبيقات على نماذج الامتحانات"
              rows={4}
              className={textareaClass}
            />
          </Field>

          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit" disabled={!branchId}>
              {editingLecture ? 'حفظ التغييرات' : 'إضافة المحاضرة'}
            </Button>
            <Button type="button" variant="outline" onClick={closeLectureForm}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lesson form */}
      <Modal
        open={lessonFormOpen}
        onClose={closeLessonForm}
        title={editingLesson ? 'تعديل الدرس' : 'إضافة درس جديد'}
        description="الدرس بيتحط جوه المحاضرة"
      >
        <form onSubmit={handleLessonSubmit} className="space-y-4">
          <Field label="عنوان الدرس">
            <Input
              value={lTitle}
              onChange={(e) => setLTitle(e.target.value)}
              placeholder="مثال: مقدمة عن الأعداد المركّبة"
              autoFocus
            />
          </Field>
          <Field label="المدة">
            <Input
              value={lDuration}
              onChange={(e) => setLDuration(e.target.value)}
              placeholder="14:30"
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={lIsFree}
              onChange={(e) => setLIsFree(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">درس مجاني (متاح للمعاينة)</span>
          </label>

          <AttachmentsUploadField
            value={lAttachments}
            onChange={setLAttachments}
            hint="ملفات إضافية (PDF، Word، صور...) يقدر الطالب يحمّلها مع الدرس."
          />
          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit">
              {editingLesson ? 'حفظ التغييرات' : 'إضافة الدرس'}
            </Button>
            <Button type="button" variant="outline" onClick={closeLessonForm}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmations */}
      <ConfirmDialog
        open={!!deletingLecture}
        onClose={closeDeleteLecture}
        onConfirm={confirmDeleteLecture}
        title="حذف المحاضرة"
        description={`هل أنت متأكد من حذف محاضرة "${deletingLecture?.title}"؟ سيتم حذف كل الدروس التابعة لها. لا يمكن التراجع.`}
      />
      <ConfirmDialog
        open={!!deletingLesson}
        onClose={closeDeleteLesson}
        onConfirm={confirmDeleteLesson}
        title="حذف الدرس"
        description={`هل أنت متأكد من حذف درس "${deletingLesson?.title}"؟ لا يمكن التراجع.`}
      />
    </>
  )
}
