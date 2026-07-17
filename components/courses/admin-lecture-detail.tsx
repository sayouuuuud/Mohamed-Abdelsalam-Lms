'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowRight,
  Layers,
  GitBranch,
  PlayCircle,
  Pencil,
  Trash2,
  Plus,
  Lock,
  Film,
  ChevronUp,
  ChevronDown,
  ListChecks,
  FileText,
  Upload,
  ClipboardList,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, Field } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ImageUploadField } from '@/components/ui/image-upload-field'
import { VideoUploadField } from '@/components/ui/video-upload-field'
import { AttachmentsUploadField } from '@/components/ui/attachments-upload-field'
import { AssignmentEditorModal } from '@/components/courses/assignment-editor-modal'
import { cn } from '@/lib/utils'
import {
  type AdminLecture,
  type AdminLesson,
  type AdminAssignment,
  type AdminContentItem,
  type LessonAttachment,
  updateLecture,
  createLesson,
  updateLesson,
  deleteLesson,
  deleteAssignment,
  reorderLectureContent,
} from '@/app/admin/courses/actions'

const textareaClass =
  'w-full resize-none rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card'

const QUESTION_KIND_BADGE = {
  mcq: { label: 'اختيار', icon: ListChecks },
  essay: { label: 'مقالي', icon: FileText },
  file: { label: 'رفع ملف', icon: Upload },
} as const

export function AdminLectureDetail({
  lecture,
  content,
  streamingEnabled = false,
}: {
  lecture: AdminLecture
  content: AdminContentItem[]
  streamingEnabled?: boolean
}) {
  const router = useRouter()

  // Local copy of the content list so reordering feels instant.
  const [items, setItems] = useState<AdminContentItem[]>(content)
  useEffect(() => setItems(content), [content])

  const lessonCount = items.filter((it) => it.kind === 'lesson').length
  const assignmentCount = items.filter((it) => it.kind === 'assignment').length

  // ── Lecture edit modal ──
  const [editOpen, setEditOpen] = useState(false)
  const [title, setTitle] = useState(lecture.title)
  const [description, setDescription] = useState(lecture.description)
  const [instructor, setInstructor] = useState(lecture.instructor ?? '')
  const [price, setPrice] = useState(String(lecture.price))
  const [oldPrice, setOldPrice] = useState(
    lecture.oldPrice != null ? String(lecture.oldPrice) : '',
  )
  const [badge, setBadge] = useState(lecture.badge ?? '')
  const [image, setImage] = useState(lecture.image ?? '')

  const handleSaveLecture = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await updateLecture(lecture.id, {
      branchId: lecture.branchId,
      title: title.trim(),
      description: description.trim(),
      instructor: instructor.trim() || null,
      price: Number(price) || 0,
      oldPrice: oldPrice ? Number(oldPrice) : null,
      badge: badge.trim() || null,
      image: image || null,
      releaseDate: lecture.releaseDate,
    })
    if (res.error) return toast.error(res.error)
    toast.success('تم تحديث المحاضرة')
    setEditOpen(false)
    router.refresh()
  }

  // ── Lesson modal ──
  const [lessonOpen, setLessonOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<AdminLesson | null>(null)
  const [lTitle, setLTitle] = useState('')
  const [lDuration, setLDuration] = useState('')
  const [lIsFree, setLIsFree] = useState(false)
  const [lVideo, setLVideo] = useState('')
  const [lVideoType, setLVideoType] = useState<'upload' | 'youtube'>('upload')
  const [lDesc, setLDesc] = useState('')
  const [lAttachments, setLAttachments] = useState<LessonAttachment[]>([])

  const openCreateLesson = () => {
    setEditingLesson(null)
    setLTitle('')
    setLDuration('')
    setLIsFree(false)
    setLVideo('')
    setLVideoType('upload')
    setLDesc('')
    setLAttachments([])
    setLessonOpen(true)
  }

  const openEditLesson = (lesson: AdminLesson) => {
    setEditingLesson(lesson)
    setLTitle(lesson.title)
    setLDuration(lesson.duration)
    setLIsFree(lesson.isFree)
    setLVideo(lesson.videoUrl ?? '')
    setLVideoType(
      lesson.videoUrl && (lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be'))
        ? 'youtube'
        : 'upload'
    )
    setLDesc(lesson.description ?? '')
    setLAttachments(lesson.attachments ?? [])
    setLessonOpen(true)
  }

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lTitle.trim()) return
    const input = {
      title: lTitle.trim(),
      duration: lDuration.trim(),
      isFree: lIsFree,
      // نوع محتوى الدرس مثبّت على "فيديو"
      contentType: 'فيديو' as const,
      videoUrl: lVideo || null,
      description: lDesc.trim() || null,
      attachments: lAttachments,
    }
    const res = editingLesson
      ? await updateLesson(editingLesson.id, input)
      : await createLesson(lecture.id, input)
    if (res.error) return toast.error(res.error)
    toast.success(editingLesson ? 'تم تحديث الدرس' : 'تمت إضافة الدرس')
    setLessonOpen(false)
    router.refresh()
  }

  // ── Assignment modal ──
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<AdminAssignment | null>(
    null,
  )

  const openCreateAssignment = () => {
    setEditingAssignment(null)
    setAssignmentOpen(true)
  }
  const openEditAssignment = (a: AdminAssignment) => {
    setEditingAssignment(a)
    setAssignmentOpen(true)
  }

  // ── Delete (lesson or assignment) ──
  const [deleting, setDeleting] = useState<AdminContentItem | null>(null)

  const confirmDelete = async () => {
    if (!deleting) return
    const item = deleting
    setDeleting(null)
    const res =
      item.kind === 'lesson'
        ? await deleteLesson(item.lesson.id)
        : await deleteAssignment(item.assignment.id)
    if (res.error) return toast.error(res.error)
    toast.success(item.kind === 'lesson' ? 'تم حذف الدرس' : 'تم حذف الواجب')
    router.refresh()
  }

  // ── Reordering ──
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
      ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
    const payload = next.map((it) => ({
      kind: it.kind,
      id: it.kind === 'lesson' ? it.lesson.id : it.assignment.id,
    }))
    const res = await reorderLectureContent(lecture.id, payload)
    if (res.error) {
      toast.error(res.error)
      setItems(items) // revert
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="size-4" />
        كل المحاضرات
      </Link>

      {/* Lecture header */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-5 p-5 sm:flex-row">
          <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/50 sm:h-44 sm:w-64">
            {lecture.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lecture.image || '/placeholder.svg'}
                alt={lecture.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                <Layers className="size-10" />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground text-balance">
                {lecture.title}
              </h1>
              {lecture.badge && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                >
                  {lecture.badge}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {lecture.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers className="size-3.5" />
                {lecture.stageTitle}
              </span>
              <span className="flex items-center gap-1.5">
                <GitBranch className="size-3.5" />
                {lecture.branchTitle}
              </span>
              <span className="flex items-center gap-1.5">
                <PlayCircle className="size-3.5" />
                <span className="font-medium text-foreground">{lessonCount}</span>
                درس
              </span>
              <span className="flex items-center gap-1.5">
                <ClipboardList className="size-3.5" />
                <span className="font-medium text-foreground">{assignmentCount}</span>
                واجب
              </span>
              <span className="font-bold text-primary">
                {lecture.price.toLocaleString('en-US')} ج
                {lecture.oldPrice != null && (
                  <span className="mr-1.5 font-normal text-muted-foreground line-through">
                    {lecture.oldPrice.toLocaleString('en-US')}
                  </span>
                )}
              </span>
            </div>

            <div className="mt-auto flex gap-2 pt-4">
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                تعديل تفاصيل المحاضرة
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Unified content list */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">محتوى المحاضرة</h2>
            <p className="text-sm text-muted-foreground">
              رتّب الدروس والواجبات بالترتيب الذي سيراه الطالب داخل المحاضرة
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openCreateLesson}>
              <PlayCircle className="size-4" />
              إضافة درس
            </Button>
            <Button size="sm" onClick={openCreateAssignment}>
              <ClipboardList className="size-4" />
              إضافة واجب
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <Card className="py-12 text-center text-sm text-muted-foreground">
            لا يوجد محتوى في هذه المحاضرة بعد. أضف درساً أو واجباً للبدء.
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <ContentRow
                key={item.kind === 'lesson' ? item.lesson.id : item.assignment.id}
                item={item}
                index={i}
                total={items.length}
                lectureId={lecture.id}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
                onEditLesson={openEditLesson}
                onEditAssignment={openEditAssignment}
                onDelete={() => setDeleting(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lecture edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="تعديل تفاصيل المحاضرة"
        description="عدّل بيانات المحاضرة الأساسية"
      >
        <form onSubmit={handleSaveLecture} className="space-y-4">
          <Field label="عنوان المحاضرة">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="الوصف">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={textareaClass}
            />
          </Field>
          <Field label="اسم المدرّس">
            <Input
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="مثال: أ. محمد عبد السلام"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="السعر (ج)">
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
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
              <Input value={badge} onChange={(e) => setBadge(e.target.value)} />
            </Field>
          </div>
          <ImageUploadField label="صورة المحاضرة" value={image} onChange={setImage} />
          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit">حفظ التغييرات</Button>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lesson modal */}
      <Modal
        open={lessonOpen}
        onClose={() => setLessonOpen(false)}
        title={editingLesson ? 'تعديل الدرس' : 'إضافة درس جديد'}
        description="حدّد بيانات الدرس وارفع الفيديو الخاص به"
      >
        <form onSubmit={handleSaveLesson} className="space-y-4">
          <Field label="عنوان الدرس">
            <Input
              value={lTitle}
              onChange={(e) => setLTitle(e.target.value)}
              placeholder="مثال: مقدمة عن الموضوع"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="المدة (تلقائية من الفيديو)">
              <Input
                value={lDuration}
                onChange={(e) => setLDuration(e.target.value)}
                placeholder="تتحسب تلقائياً بعد الرفع"
                dir="ltr"
              />
            </Field>
            <Field label="نوع المحتوى">
              <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground">
                <Film className="size-4" />
                فيديو
              </div>
            </Field>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
            <span className="block text-sm font-medium text-foreground">مصدر الفيديو</span>
            <div className="flex gap-2">
              <Button type="button" variant={lVideoType === 'upload' ? 'default' : 'outline'} onClick={() => setLVideoType('upload')} className="flex-1">رفع ملف مباشر</Button>
              <Button type="button" variant={lVideoType === 'youtube' ? 'default' : 'outline'} onClick={() => setLVideoType('youtube')} className="flex-1">رابط يوتيوب</Button>
            </div>
            {lVideoType === 'upload' ? (
              <VideoUploadField
                value={lVideo}
                onChange={setLVideo}
                hint={streamingEnabled ? 'يتم تشفير الفيديو تلقائيا بعد الرفع' : 'ارفع ملف الفيديو. هذا ما سيشاهده الطالب.'}
                streamingEnabled={streamingEnabled}
                lessonId={editingLesson?.id}
                onDurationDetected={setLDuration}
              />
            ) : (
              <Field label="رابط يوتيوب">
                <Input
                  value={lVideo}
                  onChange={(e) => setLVideo(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  dir="ltr"
                />
              </Field>
            )}
          </div>
          <Field label="وصف الدرس">
            <textarea
              value={lDesc}
              onChange={(e) => setLDesc(e.target.value)}
              rows={3}
              placeholder="نبذة عن محتوى الدرس"
              className={textareaClass}
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
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">مرفقات الدرس</span>
            <AttachmentsUploadField
              value={lAttachments}
              onChange={setLAttachments}
              hint="ملفات إضافية (PDF، Word، صور...) يقدر الطالب يحمّلها مع الدرس. الحد الأقصى 100 MB لكل ملف."
            />
          </div>
          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit">
              {editingLesson ? 'حفظ التغييرات' : 'إضافة الدرس'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setLessonOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assignment modal */}
      <AssignmentEditorModal
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        lectureId={lecture.id}
        assignment={editingAssignment}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={deleting?.kind === 'lesson' ? 'حذف الدرس' : 'حذف الواجب'}
        description={
          deleting
            ? `هل أنت متأكد من حذف "${deleting.kind === 'lesson'
              ? deleting.lesson.title
              : deleting.assignment.title
            }"؟ لا يمكن التراجع.`
            : ''
        }
      />
    </div>
  )
}

function ContentRow({
  item,
  index,
  total,
  lectureId,
  onMoveUp,
  onMoveDown,
  onEditLesson,
  onEditAssignment,
  onDelete,
}: {
  item: AdminContentItem
  index: number
  total: number
  lectureId: string
  onMoveUp: () => void
  onMoveDown: () => void
  onEditLesson: (l: AdminLesson) => void
  onEditAssignment: (a: AdminAssignment) => void
  onDelete: () => void
}) {
  return (
    <Card className="flex flex-row items-center gap-3 p-3">
      {/* Reorder controls */}
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          aria-label="تحريك لأعلى"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          aria-label="تحريك لأسفل"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-muted-foreground">
        {index + 1}
      </span>

      {item.kind === 'lesson' ? (
        <LessonRowBody lecture={lectureId} lesson={item.lesson} />
      ) : (
        <AssignmentRowBody assignment={item.assignment} />
      )}

      {/* Actions */}
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() =>
            item.kind === 'lesson'
              ? onEditLesson(item.lesson)
              : onEditAssignment(item.assignment)
          }
        >
          <Pencil className="size-4" />
          <span className="sr-only">تعديل</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
          <span className="sr-only">حذف</span>
        </Button>
      </div>
    </Card>
  )
}

function LessonRowBody({ lecture, lesson }: { lecture: string; lesson: AdminLesson }) {
  return (
    <Link
      href={`/admin/courses/${lecture}/lessons/${lesson.id}`}
      className="flex min-w-0 flex-1 items-center gap-3"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <PlayCircle className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/5 text-[10px] font-medium text-primary"
          >
            درس
          </Badge>
          <span className="truncate text-sm font-semibold text-foreground">
            {lesson.title}
          </span>
          {lesson.isFree ? (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
            >
              مجاني
            </Badge>
          ) : (
            <Lock className="size-3 text-muted-foreground" />
          )}
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
            <Film className="size-3" /> {lesson.contentType ?? 'فيديو'}
          </span>
          {lesson.contentType === 'فيديو' && !lesson.videoUrl && (
            <span className="text-[10px] font-medium text-rose-500">بدون فيديو</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {lesson.duration || 'بدون مدة'}
        </span>
      </div>
    </Link>
  )
}

function AssignmentRowBody({ assignment }: { assignment: AdminAssignment }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <ClipboardList className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-300/40 bg-amber-50 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
          >
            واجب
          </Badge>
          <span className="truncate text-sm font-semibold text-foreground">
            {assignment.title}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {assignment.questions.length} سؤال · {assignment.points} درجة
          </span>
          {(['mcq', 'essay', 'file'] as const).map((k) => {
            const count = assignment.questions.filter((q) => q.kind === k).length
            if (count === 0) return null
            const Meta = QUESTION_KIND_BADGE[k]
            const Icon = Meta.icon
            return (
              <span key={k} className="inline-flex items-center gap-1">
                <Icon className="size-3" />
                {count} {Meta.label}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
