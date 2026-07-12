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
import { unenrollMonthlyCourse } from '@/app/student/actions'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { EnrolledMonthlyCourse } from '@/lib/student-courses-data'

type Filter = 'all' | 'in-progress' | 'completed' | 'new'

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'new', label: 'فيها جديد' },
  { key: 'in-progress', label: 'قيد التقدّم' },
  { key: 'completed', label: 'مكتملة' },
]

export function StudentCoursesPage({
  courses = [],
}: {
  courses?: EnrolledMonthlyCourse[]
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [courseToDelete, setCourseToDelete] = useState<EnrolledMonthlyCourse | null>(null)

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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">كورساتي</h1>
        <p className="text-sm text-muted-foreground">
          تابع الكورسات اللي مشترك فيها، وشوف المحاضرات الجديدة اللي نزّلها المدرّس أول بأول.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex flex-row items-center gap-4 p-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
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
              'flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:bg-secondary',
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

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <GraduationCap className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">لا توجد كورسات في هذا التصنيف.</p>
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

      <ConfirmDialog
        open={!!courseToDelete}
        onClose={() => setCourseToDelete(null)}
        onConfirm={async () => {
          if (!courseToDelete) return
          const res = await unenrollMonthlyCourse(courseToDelete.dbId)
          if (res.error) toast.error(res.error)
          else toast.success('تم إلغاء الاشتراك في الكورس')
        }}
        title="إلغاء الاشتراك في الكورس"
        description="هل أنت متأكد من إلغاء اشتراكك في هذا الكورس؟ هتفقد الوصول لكل محاضراته. (لا يمكن التراجع)"
        confirmLabel="إلغاء الاشتراك"
        cancelLabel="تراجع"
      />
    </div>
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
    <Card className="flex flex-col overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        {/* Cover */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-56">
          <Image
            src={course.image || '/placeholder.svg'}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 100vw, 224px"
            className="object-cover"
          />
          {course.newLecturesCount > 0 && (
            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground shadow">
              <Sparkles className="size-3" />
              {course.newLecturesCount} جديد
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col">
          <p className="text-xs font-semibold text-primary">
            {course.stageTitle}{course.branchTitle ? ` · ${course.branchTitle}` : ''}
          </p>
          <h3 className="mt-0.5 text-lg font-bold text-foreground">{course.title}</h3>
          {course.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <PlayCircle className="size-3.5" />
              {course.totalLectures} محاضرة
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="size-3.5" />
              {course.totalLessons} درس
            </span>
          </div>

          {/* Progress */}
          <div className="mt-auto pt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{course.progressPercent}% مكتمل</span>
              <span className="text-muted-foreground">
                {course.completedLessons}/{course.totalLessons} درس
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary"
              aria-expanded={open}
            >
              {open ? 'إخفاء المحاضرات' : 'عرض المحاضرات'}
              <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
            </button>
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

      {/* Lectures list */}
      {open && (
        <div className="flex flex-col gap-2 border-t border-border bg-secondary/30 p-4">
          {course.lectures.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              المدرّس لسه ما نزّلش محاضرات في الكورس ده. تابعنا قريبًا.
            </p>
          ) : (
            course.lectures.map((lecture, index) => {
              const done = lecture.totalLessons > 0 && lecture.completedLessons === lecture.totalLessons
              return (
                <Link
                  key={lecture.dbId}
                  href={`/student/courses/${lecture.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-secondary"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold',
                        done
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-primary/10 text-primary',
                      )}
                    >
                      {done ? <CheckCircle2 className="size-4" /> : index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-foreground">{lecture.title}</p>
                        {lecture.isNew && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                            <Sparkles className="size-2.5" />
                            جديد
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lecture.completedLessons}/{lecture.totalLessons} درس
                      </p>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
                    <PlayCircle className="size-4" />
                    {lecture.completedLessons > 0 ? 'متابعة' : 'ابدأ'}
                  </span>
                </Link>
              )
            })
          )}
        </div>
      )}
    </Card>
  )
}
