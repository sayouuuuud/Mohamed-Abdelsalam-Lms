'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Pencil,
  Trash2,
  Plus,
  BookOpen,
  EyeOff,
  ChevronDown,
  PlayCircle,
  Check,
  X,
  Layers,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCurriculum } from './curriculum-context'
import {
  createCourseSection,
  updateCourseSection,
  deleteCourseSection,
  type AdminBranch,
  type AdminStage,
  type AdminMonthlyCourse,
  type AdminCourseLecture,
} from '@/app/admin/categories/actions'

function formatEGP(value: number) {
  return value.toLocaleString('en-US')
}

// A single lecture row inside the expanded course panel.
function LectureRow({ lecture, index }: { lecture: AdminCourseLecture; index: number }) {
  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-bold text-muted-foreground">
        {index + 1}
      </span>
      <PlayCircle className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="line-clamp-1">{lecture.title}</span>
    </li>
  )
}

function CourseCard({ course }: { course: AdminMonthlyCourse }) {
  const { openEditCourse, requestDeleteCourse } = useCurriculum()
  const router = useRouter()

  const [expanded, setExpanded] = useState(false)
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionTitle, setEditingSectionTitle] = useState('')
  const [busy, setBusy] = useState(false)

  // Group lectures by their section, preserving section order, with an
  // "بدون تصنيف" bucket at the end for lectures not assigned to any section.
  const groups = useMemo(() => {
    const bySection = new Map<string, AdminCourseLecture[]>()
    const ungrouped: AdminCourseLecture[] = []
    for (const lecture of course.lectures) {
      if (lecture.sectionId) {
        const list = bySection.get(lecture.sectionId) ?? []
        list.push(lecture)
        bySection.set(lecture.sectionId, list)
      } else {
        ungrouped.push(lecture)
      }
    }
    const ordered = course.sections.map((section) => ({
      id: section.id,
      title: section.title,
      lectures: bySection.get(section.id) ?? [],
    }))
    return { ordered, ungrouped }
  }, [course.lectures, course.sections])

  const handleAddSection = async () => {
    const title = newSectionTitle.trim()
    if (!title) return
    setBusy(true)
    const res = await createCourseSection({ courseId: course.id, title })
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('تمت إضافة التصنيف')
    setNewSectionTitle('')
    setAddingSection(false)
    router.refresh()
  }

  const handleUpdateSection = async (id: string) => {
    const title = editingSectionTitle.trim()
    if (!title) return
    setBusy(true)
    const res = await updateCourseSection(id, { title })
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('تم تحديث التصنيف')
    setEditingSectionId(null)
    setEditingSectionTitle('')
    router.refresh()
  }

  const handleDeleteSection = async (id: string) => {
    setBusy(true)
    const res = await deleteCourseSection(id)
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('تم حذف التصنيف — محاضراته رجعت «بدون تصنيف»')
    router.refresh()
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-[16/9] bg-secondary">
        {course.image ? (
          <Image
            src={course.image || '/placeholder.svg'}
            alt={course.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <BookOpen className="size-6" />
          </div>
        )}
        {!course.isPublished && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-foreground/80 px-2 py-1 text-xs font-bold text-background">
            <EyeOff className="size-3" />
            غير منشور
          </span>
        )}
        {course.badge && (
          <span className="absolute left-2 top-2 rounded-lg bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
            {course.badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h4 className="text-sm font-bold text-foreground">{course.title}</h4>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {course.description || 'بدون وصف'}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary" className="gap-1">
            <BookOpen className="size-3" />
            {course.lectureCount} محاضرة
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Layers className="size-3" />
            {course.sections.length} تصنيف
          </Badge>
          <Badge variant="secondary">{formatEGP(course.price)} ج.م</Badge>
          {course.oldPrice != null && (
            <span className="text-xs text-muted-foreground line-through">
              {formatEGP(course.oldPrice)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <span>إدارة المحتوى والتصنيفات</span>
          <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
        </button>

        {expanded && (
          <div className="flex flex-col gap-3 rounded-lg bg-secondary/50 p-3">
            {/* Section manager */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-foreground">التصنيفات</p>
              {!addingSection && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setAddingSection(true)}
                >
                  <Plus className="size-3.5" />
                  تصنيف جديد
                </Button>
              )}
            </div>

            {addingSection && (
              <div className="flex items-center gap-2">
                <Input
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="اسم التصنيف (مثال: المراجعة النهائية)"
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault()
                      handleAddSection()
                    }
                  }}
                  autoFocus
                />
                <Button size="icon" className="size-8 shrink-0" disabled={busy || !newSectionTitle.trim()} onClick={handleAddSection} aria-label="حفظ التصنيف">
                  <Check className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8 shrink-0"
                  onClick={() => {
                    setAddingSection(false)
                    setNewSectionTitle('')
                  }}
                  aria-label="إلغاء"
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}

            {/* Grouped lectures per section */}
            {groups.ordered.map((section) => (
              <div key={section.id} className="rounded-lg border border-border bg-background p-2">
                {editingSectionId === section.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingSectionTitle}
                      onChange={(e) => setEditingSectionTitle(e.target.value)}
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                          e.preventDefault()
                          handleUpdateSection(section.id)
                        }
                      }}
                      autoFocus
                    />
                    <Button size="icon" className="size-8 shrink-0" disabled={busy || !editingSectionTitle.trim()} onClick={() => handleUpdateSection(section.id)} aria-label="حفظ">
                      <Check className="size-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="size-8 shrink-0" onClick={() => setEditingSectionId(null)} aria-label="إلغاء">
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="size-3.5 text-primary" />
                      <span className="text-xs font-bold text-foreground">{section.title}</span>
                      <span className="text-[10px] text-muted-foreground">({section.lectures.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => {
                          setEditingSectionId(section.id)
                          setEditingSectionTitle(section.title)
                        }}
                        aria-label="تعديل التصنيف"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        disabled={busy}
                        onClick={() => handleDeleteSection(section.id)}
                        aria-label="حذف التصنيف"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                {section.lectures.length > 0 ? (
                  <ol className="mt-1 flex flex-col gap-0.5">
                    {section.lectures.map((lecture, index) => (
                      <LectureRow key={lecture.id} lecture={lecture} index={index} />
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 px-2 text-[11px] text-muted-foreground">مفيش محاضرات في التصنيف ده لسه.</p>
                )}
              </div>
            ))}

            {/* Ungrouped lectures */}
            {groups.ungrouped.length > 0 && (
              <div className="rounded-lg border border-dashed border-border bg-background p-2">
                <p className="px-2 text-xs font-bold text-muted-foreground">بدون تصنيف</p>
                <ol className="mt-1 flex flex-col gap-0.5">
                  {groups.ungrouped.map((lecture, index) => (
                    <LectureRow key={lecture.id} lecture={lecture} index={index} />
                  ))}
                </ol>
              </div>
            )}

            {course.lectureCount === 0 && course.sections.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                لسه مفيش محاضرات ولا تصنيفات. ضيف تصنيف هنا، وبعدين اربط المحاضرات بيه من نموذج المحاضرة.
              </p>
            )}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() => openEditCourse(course)}
          >
            <Pencil className="size-3.5" />
            تعديل
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
            onClick={() => requestDeleteCourse(course)}
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">حذف الكورس</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export function CoursesGrid() {
  const { stages, openCreateCourse } = useCurriculum()

  const branchesWithContext: { stage: AdminStage; branch: AdminBranch }[] = []
  for (const stage of stages) {
    for (const branch of stage.branches) {
      branchesWithContext.push({ stage, branch })
    }
  }

  const totalCourses = branchesWithContext.reduce(
    (sum, { branch }) => sum + branch.courses.length,
    0,
  )

  if (totalCourses === 0) {
    return (
      <Card className="flex flex-col items-center gap-4 p-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <BookOpen className="size-6" />
        </div>
        <p className="text-sm text-muted-foreground">
          لا توجد كورسات بعد. افتح أي فرع من تاب «الفروع» واضغط «كورس» لإضافة أول كورس.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {branchesWithContext.map(({ stage, branch }) =>
        branch.courses.length === 0 ? null : (
          <Card key={branch.id} className="gap-0 overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground">{stage.title}</p>
                <h3 className="mt-0.5 text-base font-bold text-foreground">{branch.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {branch.courses.length} كورس داخل هذا الفرع
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => openCreateCourse(branch.id)}
              >
                <Plus className="size-4" />
                إضافة كورس
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {branch.courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </Card>
        ),
      )}
    </div>
  )
}
