'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Lock,
  Play,
  PlayCircle,
  Users,
  Paperclip,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getCourseLessons,
  getCourseItems,
  getSectionItems,
  type CourseDetail,
  type Lesson,
  type Section,
} from '@/lib/student-courses-data'

const lessonIcon = (lesson: Lesson) => {
  if (lesson.completed) return CheckCircle2
  if (lesson.locked) return Lock
  if (lesson.type === 'مقال') return FileText
  return PlayCircle
}

function CurriculumSection({
  courseId,
  section,
  defaultOpen,
}: {
  courseId: string
  section: Section
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const items = getSectionItems(section)
  const lessonItems = items.filter((it) => it.kind === 'lesson')
  const assignmentCount = items.length - lessonItems.length
  const done = lessonItems.filter(
    (it) => it.kind === 'lesson' && it.lesson.completed,
  ).length

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-secondary/50 px-4 py-3 text-right transition-colors hover:bg-secondary"
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
          <span className="text-sm font-bold text-foreground">{section.title}</span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {done}/{lessonItems.length} درس
          {assignmentCount > 0 ? ` • ${assignmentCount} واجب` : ''}
        </span>
      </button>

      {open && (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            if (item.kind === 'lesson') {
              const lesson = item.lesson
              const locked = lesson.locked
              const Icon = locked ? Lock : lessonIcon(lesson)
              const content = (
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    locked ? 'cursor-not-allowed opacity-60' : 'hover:bg-secondary/40',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-5 shrink-0',
                      lesson.completed
                        ? 'text-primary'
                        : locked
                          ? 'text-muted-foreground'
                          : 'text-foreground',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {lesson.title}
                    </p>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <span>درس · {lesson.type}</span>
                      {lesson.attachments && lesson.attachments.length > 0 && (
                        <>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="flex items-center gap-1 text-primary">
                            <Paperclip className="size-3" />
                            {lesson.attachments.length} مرفقات
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {lesson.duration}
                  </span>
                </div>
              )
              return (
                <li key={lesson.id}>
                  {locked ? (
                    content
                  ) : (
                    <Link href={`/student/courses/${courseId}/lessons/${lesson.id}`}>
                      {content}
                    </Link>
                  )}
                </li>
              )
            }

            // Assignment item
            const assignment = item.assignment
            const locked = assignment.locked ?? false
            const qCount = assignment.questions?.length ?? 0
            const content = (
              <div
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  locked ? 'cursor-not-allowed opacity-60' : 'hover:bg-primary/5',
                )}
              >
                {locked ? (
                  <Lock className="size-5 shrink-0 text-muted-foreground" />
                ) : (
                  <ClipboardList className="size-5 shrink-0 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {assignment.title}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    واجب{qCount > 0 ? ` · ${qCount} سؤال` : ''}
                    {locked && ' • أكمل الدروس السابقة لفتحه'}
                  </span>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {assignment.points} نقطة
                </span>
              </div>
            )
            return (
              <li key={assignment.id}>
                {locked ? (
                  content
                ) : (
                  <Link href={`/student/assignments/${assignment.id}`}>{content}</Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function CourseOverview({ course }: { course: CourseDetail }) {
  const percent = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0
  const allItems = getCourseItems(course)
  const nextItem = allItems.find((it) => {
    if (it.kind === 'lesson') return !it.lesson.completed && !it.lesson.locked
    if (it.kind === 'assignment') {
      return (it.assignment.status !== 'تم التسليم' && it.assignment.status !== 'مصحّح') && !it.assignment.locked
    }
    return false
  }) ?? allItems[0]

  const courseAssignments = allItems
    .filter((it) => it.kind === 'assignment')
    .map((it) => (it as Extract<typeof it, { kind: 'assignment' }>).assignment)

  const meta = [

    { icon: Users, label: `${course.studentsCount.toLocaleString('ar-EG')} طالب` },
    { icon: Clock, label: course.durationHours },
    { icon: BookOpen, label: `${course.totalLessons} درس` },
  ]

  const nextHref = nextItem?.kind === 'assignment' 
    ? `/student/assignments/${nextItem.assignment.id}`
    : nextItem?.kind === 'lesson' 
      ? `/student/courses/${course.id}/lessons/${nextItem.lesson.id}`
      : '#'

  const nextLabel = nextItem?.kind === 'assignment'
    ? 'حل الواجب'
    : percent === 0 ? 'ابدأ الكورس' : 'متابعة الدرس'

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
        <Link
          href="/student/courses"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-4" />
          العودة إلى محاضراتي
        </Link>

      {/* Hero */}
      <Card className="flex flex-col gap-6 p-6 lg:flex-row">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl lg:w-80">
          <Image
            src={course.image || '/placeholder.svg'}
            alt={course.title}
            fill
            sizes="(max-width: 1024px) 100vw, 320px"
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex size-14 items-center justify-center rounded-full bg-white/90 text-sidebar">
              <Play className="size-6 fill-current" />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-primary">{course.category}</span>
          <h1 className="mt-1 text-2xl font-bold leading-snug text-foreground text-balance">
            {course.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {course.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {meta.map((m) => (
              <span key={m.label} className="flex items-center gap-1.5">
                <m.icon
                  className={cn(
                    'size-4',

                  )}
                />
                {m.label}
              </span>
            ))}
          </div>

          <div className="mt-auto pt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{percent}% مكتمل</span>
              <span className="text-muted-foreground">
                {course.completedLessons} من {course.totalLessons} درس
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            {nextItem ? (
              <Link
                href={nextHref}
                className={cn(buttonVariants(), "mt-4 w-fit")}
              >
                {nextItem.kind === 'assignment' ? <ClipboardList className="size-4" /> : <Play className="size-4" />}
                {nextLabel}
              </Link>
            ) : (
              <Button disabled className="mt-4 w-fit opacity-50">
                لا يوجد محتوى بعد
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Body */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* What you learn */}
          {course.whatYouLearn.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold text-foreground">ماذا ستتعلّم</h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {course.whatYouLearn.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Curriculum */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">محتوى الكورس</h2>
              <span className="text-xs text-muted-foreground">
                {course.sections.length} وحدات • {course.totalLessons} درس
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {course.sections.map((section, i) => (
                <CurriculumSection
                  key={section.id}
                  courseId={course.id}
                  section={section}
                  defaultOpen={i === 0}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground">معلومات الكورس</h2>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">المدرّس</dt>
                <dd className="font-medium text-foreground">{course.instructor}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">المستوى</dt>
                <dd className="font-medium text-foreground">{course.level}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">المدة</dt>
                <dd className="font-medium text-foreground">{course.durationHours}</dd>
              </div>
            </dl>
          </Card>

          {/* Assignments */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground">واجبات الكورس</h2>
            {courseAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد واجبات حالياً.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {courseAssignments.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className="flex items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {a.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.questions?.length ?? 0} سؤال · {a.points} نقطة
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
