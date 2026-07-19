'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  PlayCircle,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { unenrollMonthlyCourse, unenrollCourse } from '@/app/student/actions'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { EnrolledMonthlyCourse, CourseProgress } from '@/lib/student-courses-data'

type Filter = 'all' | 'in-progress' | 'completed' | 'new'

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'new', label: 'فيها جديد' },
  { key: 'in-progress', label: 'قيد التقدّم' },
  { key: 'completed', label: 'مكتملة' },
]

export function StudentCoursesPage({
  courses = [],
  lectures = [],
}: {
  courses?: EnrolledMonthlyCourse[]
  lectures?: CourseProgress[]
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [courseToDelete, setCourseToDelete] = useState<EnrolledMonthlyCourse | null>(null)
  const [lectureToDelete, setLectureToDelete] = useState<CourseProgress | null>(null)

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (filter === 'completed') return c.progressPercent === 100
      if (filter === 'in-progress') return c.progressPercent < 100
      if (filter === 'new') return c.newLecturesCount > 0
      return true
    })
  }, [courses, filter])

  const completedCourses = courses.filter((c) => c.progressPercent === 100).length
  const totalNew = courses.reduce((sum, c) => sum + c.newLecturesCount, 0)
  const totalLessons = courses.reduce((sum, c) => sum + c.totalLessons, 0)
  const completedLessons = courses.reduce((sum, c) => sum + c.completedLessons, 0)

  const stats = [
    { label: 'كورسات مشترك فيها', value: courses.length, icon: GraduationCap },
    { label: 'محاضرات جديدة', value: totalNew, icon: Sparkles },
    { label: 'كورسات مكتملة', value: completedCourses, icon: CheckCircle2 },
    { label: 'دروس أكملتها', value: `${completedLessons}/${totalLessons}`, icon: BookOpen },
  ]

  const lecturesFiltered = useMemo(() => {
    return lectures.filter((l) => {
      const progressPercent = l.totalLessons > 0 ? Math.round((l.completedLessons / l.totalLessons) * 100) : 0
      if (filter === 'completed') return progressPercent === 100
      if (filter === 'in-progress') return progressPercent < 100
      if (filter === 'new') return false // lectures don't have 'new' state really
      return true
    })
  }, [lectures, filter])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-black tracking-tight text-foreground">كورساتي <span className="text-primary"></span></h1>
        <p className="text-base font-medium text-muted-foreground">
          تابع تقدّمك وكمل مسيرتك التعليمية بنجاح من مكان ما وقفت.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="courses" className="flex flex-col gap-6">
        <TabsList className="w-full rounded-2xl border border-border/50 bg-secondary/50 p-1 shadow-sm backdrop-blur-xl sm:w-fit">
          <TabsTrigger value="courses" className="rounded-xl px-6 py-2.5 font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">الكورسات المشترك فيها</TabsTrigger>
          <TabsTrigger value="lectures" className="rounded-xl px-6 py-2.5 font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">المحاضرات المستقلة</TabsTrigger>
        </TabsList>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="group relative flex flex-row items-center gap-4 overflow-hidden border-border/50 bg-gradient-to-b from-card to-secondary/10 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="absolute -left-10 -top-10 size-24 rounded-full bg-primary/5 blur-2xl transition-colors group-hover:bg-primary/10" />
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <s.icon className="size-5" />
              </div>
              <div className="relative z-10">
                <p className="text-3xl font-black text-foreground">{s.value}</p>
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold transition-all',
                filter === f.key
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'border border-border/50 bg-card text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
              )}
            >
              {f.label}
              {f.key === 'new' && totalNew > 0 && (
                <span className={cn(
                  'grid min-w-5 place-items-center rounded-full px-1.5 text-xs font-bold',
                  filter === f.key ? 'bg-primary-foreground/20' : 'bg-primary/15 text-primary',
                )}>
                  {totalNew}
                </span>
              )}
            </button>
          ))}
        </div>

        <TabsContent value="courses" className="mt-0 outline-none">
          {/* List */}
          {filtered.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-4 border-dashed border-border/60 bg-secondary/20 py-20 text-center">
              <div className="grid size-20 place-items-center rounded-3xl bg-background text-muted-foreground shadow-sm">
                <GraduationCap className="size-8" />
              </div>
              <p className="font-medium text-muted-foreground">لا توجد كورسات في هذا التصنيف.</p>
              <Button nativeButton={false} render={<Link href="/student/browse" />}>
                تصفّح الكورسات المتاحة
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              {filtered.map((course) => (
                <CourseCard
                  key={course.dbId}
                  course={course}
                  onDelete={() => setCourseToDelete(course)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lectures" className="mt-0 outline-none">
          {lecturesFiltered.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-4 border-dashed border-border/60 bg-secondary/20 py-20 text-center">
              <div className="grid size-20 place-items-center rounded-3xl bg-background text-muted-foreground shadow-sm">
                <BookOpen className="size-8" />
              </div>
              <p className="font-medium text-muted-foreground">لا توجد محاضرات مستقلة في هذا التصنيف.</p>
              <Button nativeButton={false} render={<Link href="/student/browse" />}>
                تصفّح المحاضرات المتاحة
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              {lecturesFiltered.map((lecture) => (
                <LectureCard
                  key={lecture.id}
                  lecture={lecture}
                  onDelete={() => setLectureToDelete(lecture)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!courseToDelete}
        onClose={() => setCourseToDelete(null)}
        onConfirm={async () => {
          if (!courseToDelete) return
          const res = await unenrollMonthlyCourse(courseToDelete.dbId)
          if (res.error) toast.error(res.error)
          else {
            toast.success('تم إلغاء الاشتراك في الكورس')
            setCourseToDelete(null)
          }
        }}
        title="إلغاء الاشتراك في الكورس"
        description="هل أنت متأكد من إلغاء اشتراكك في هذا الكورس؟ هتفقد الوصول لكل محاضراته. (لا يمكن التراجع)"
        confirmLabel="إلغاء الاشتراك"
        cancelLabel="تراجع"
      />

      <ConfirmDialog
        open={!!lectureToDelete}
        onClose={() => setLectureToDelete(null)}
        onConfirm={async () => {
          if (!lectureToDelete) return
          const res = await unenrollCourse(lectureToDelete.id)
          if (res.error) toast.error(res.error)
          else {
            toast.success('تم إلغاء الاشتراك في المحاضرة')
            setLectureToDelete(null)
          }
        }}
        title="إلغاء الاشتراك في المحاضرة"
        description="هل أنت متأكد من إلغاء اشتراكك في هذه المحاضرة؟ هتفقد الوصول إليها. (لا يمكن التراجع)"
        confirmLabel="إلغاء الاشتراك"
        cancelLabel="تراجع"
      />
    </div>
  )
}

function LectureCard({
  lecture,
  onDelete,
}: {
  lecture: CourseProgress
  onDelete: () => void
}) {
  const percent = lecture.totalLessons > 0 ? Math.round((lecture.completedLessons / lecture.totalLessons) * 100) : 0

  return (
    <Card className="group relative flex flex-col overflow-hidden border-border/50 p-0 transition-all hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative z-10 flex flex-col gap-4 p-5 sm:flex-row">
        {/* Cover */}
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl border border-border/10 bg-muted shadow-inner sm:w-64">
          <Image
            src={lecture.image || '/placeholder.svg'}
            alt={lecture.title}
            fill
            sizes="(max-width: 640px) 100vw, 256px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col">
          <p className="text-sm font-semibold text-primary">
            {lecture.category}
          </p>
          <h3 className="mt-1 text-xl font-bold text-foreground">{lecture.title}</h3>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-3 py-1">
              <BookOpen className="size-4" />
              {lecture.totalLessons} درس
            </span>
          </div>

          {/* Progress */}
          <div className="mt-auto pt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-bold text-foreground">{percent}% مكتمل</span>
              <span className="font-medium text-muted-foreground">
                {lecture.completedLessons}/{lecture.totalLessons} درس
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-1000 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Link
              href={`/student/courses/${lecture.id}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30"
            >
              <PlayCircle className="size-4" />
              {lecture.completedLessons > 0 ? 'متابعة المحاضرة' : 'ابدأ المحاضرة'}
            </Link>
            <Button
              variant="destructive"
              size="icon"
              onClick={onDelete}
              title="إلغاء الاشتراك"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function CourseCard({
  course,
  onDelete,
}: {
  course: EnrolledMonthlyCourse
  onDelete: () => void
}) {
  const [open, setOpen] = useState(course.newLecturesCount > 0)

  return (
    <Card className="group relative flex flex-col overflow-hidden border-border/50 p-0 transition-all hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative z-10 flex flex-col gap-4 p-5 sm:flex-row">
        {/* Cover */}
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl border border-border/10 bg-muted shadow-inner sm:w-64">
          <Image
            src={course.image || '/placeholder.svg'}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 100vw, 256px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {course.newLecturesCount > 0 && (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-xl bg-primary/90 px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow backdrop-blur-sm">
              <Sparkles className="size-3" />
              {course.newLecturesCount} محاضرة جديدة
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col">
          <p className="text-sm font-semibold text-primary">
            {course.stageTitle}{course.branchTitle ? ` · ${course.branchTitle}` : ''}
          </p>
          <h3 className="mt-1 text-xl font-bold text-foreground">{course.title}</h3>
          {course.description && (
            <p className="mt-1.5 line-clamp-2 text-sm font-medium text-muted-foreground">{course.description}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-3 py-1">
              <PlayCircle className="size-4" />
              {course.totalLectures} محاضرة
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-3 py-1">
              <BookOpen className="size-4" />
              {course.totalLessons} درس
            </span>
          </div>

          {/* Progress */}
          <div className="mt-auto pt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-bold text-foreground">{course.progressPercent}% مكتمل</span>
              <span className="font-medium text-muted-foreground">
                {course.completedLessons}/{course.totalLessons} درس
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-1000 ease-out"
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/50 bg-secondary/30 px-4 py-3 text-sm font-bold text-foreground transition-all hover:bg-secondary/80 hover:shadow-sm"
              aria-expanded={open}
            >
              {open ? 'إخفاء المحاضرات' : 'عرض المحاضرات'}
              <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
            </button>
            <Button
              variant="destructive"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              onClick={onDelete}
              title="إلغاء الاشتراك"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Lectures list — grouped by section when the course has sections */}
      {open && (
        <div className="relative z-10 flex flex-col gap-5 border-t border-border/50 bg-secondary/10 p-5 shadow-inner">
          {course.lectures.length === 0 ? (
            <p className="py-8 text-center font-medium text-muted-foreground">
              المدرّس لسه ما نزّلش محاضرات في الكورس ده. تابعنا قريبًا.
            </p>
          ) : (
            groupEnrolledLectures(course).map((group) => (
              <div key={group.id ?? 'no-section'} className="flex flex-col gap-2">
                {group.title && (
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="h-4 w-1 rounded-full bg-primary" />
                    <h4 className="text-sm font-bold text-foreground">{group.title}</h4>
                    <span className="text-xs text-muted-foreground">({group.lectures.length})</span>
                  </div>
                )}
                {group.lectures.map((lecture, index) => (
                  <EnrolledLectureRow key={lecture.dbId} lecture={lecture} index={index} />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  )
}

// Groups a course's lectures by section (section order preserved), with any
// unclassified lectures placed in a trailing group. Courses without sections
// return a single untitled group.
function groupEnrolledLectures(course: EnrolledMonthlyCourse) {
  const groups: { id: string | null; title: string | null; lectures: EnrolledMonthlyCourse['lectures'] }[] = []
  const sections = course.sections ?? []
  if (sections.length === 0) {
    return [{ id: null, title: null, lectures: course.lectures }]
  }
  for (const section of sections) {
    const lectures = course.lectures.filter((l) => l.sectionId === section.id)
    if (lectures.length > 0) groups.push({ id: section.id, title: section.title, lectures })
  }
  const unclassified = course.lectures.filter(
    (l) => !l.sectionId || !sections.some((s) => s.id === l.sectionId),
  )
  if (unclassified.length > 0) {
    groups.push({
      id: null,
      title: groups.length > 0 ? 'محاضرات أخرى' : null,
      lectures: unclassified,
    })
  }
  return groups
}

function EnrolledLectureRow({
  lecture,
  index,
}: {
  lecture: EnrolledMonthlyCourse['lectures'][number]
  index: number
}) {
  const done = lecture.totalLessons > 0 && lecture.completedLessons === lecture.totalLessons
  const lectureHref = `/student/courses/${lecture.id}`
  const actionHref = lecture.nextLessonId
    ? `${lectureHref}/lessons/${lecture.nextLessonId}`
    : lectureHref

  return (
    <div className="group/row flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/50 hover:shadow-md">
      <Link
        href={lectureHref}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`عرض تفاصيل محاضرة ${lecture.title}`}
      >
        <span
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl text-sm font-black transition-colors',
            done
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-primary/10 text-primary group-hover/row:bg-primary group-hover/row:text-primary-foreground',
          )}
        >
          {done ? <CheckCircle2 className="size-5" /> : index + 1}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-bold text-foreground">{lecture.title}</p>
            {lecture.isNew && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                <Sparkles className="size-2.5" />
                جديد
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {lecture.completedLessons}/{lecture.totalLessons} درس مكتمل
          </p>
        </div>
      </Link>
      <Link
        href={actionHref}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`${lecture.completedLessons > 0 ? 'متابعة' : 'ابدأ'} محاضرة ${lecture.title}`}
      >
        <PlayCircle className="size-4" />
        {lecture.completedLessons > 0 ? 'متابعة' : 'ابدأ'}
      </Link>
    </div>
  )
}
