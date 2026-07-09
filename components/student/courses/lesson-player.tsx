'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileImage,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  PlayCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { VideoPlayer } from '@/components/student/courses/video-player'
import { markLessonComplete } from '@/app/student/progress/actions'
import { getCourseItems, type CourseDetail, type Lesson } from '@/lib/student-types'

const lessonIcon = (lesson: Lesson) => {
  if (lesson.completed) return CheckCircle2
  if (lesson.locked) return Lock
  if (lesson.type === 'مقال') return FileText
  return PlayCircle
}

export function LessonPlayer({
  course,
  lesson,
  index,
  all,
}: {
  course: CourseDetail
  lesson: Lesson
  index: number
  all: Lesson[]
}) {
  const router = useRouter()
  const [completed, setCompleted] = useState(lesson.completed)
  const [isPending, startTransition] = useTransition()

  // Unified ordered content (lessons + assignments) for navigation + playlist.
  const items = getCourseItems(course)
  const currentItemIndex = items.findIndex(
    (it) => it.kind === 'lesson' && it.lesson.id === lesson.id,
  )
  const nextItem =
    currentItemIndex >= 0 ? items[currentItemIndex + 1] : undefined
  const prevItem =
    currentItemIndex > 0 ? items[currentItemIndex - 1] : undefined

  const courseProgress = Math.round(
    (all.filter((l) => l.completed).length / Math.max(all.length, 1)) * 100,
  )

  const markComplete = () => {
    if (completed || !lesson.lessonId) {
      setCompleted(true)
      return
    }
    startTransition(async () => {
      const res = await markLessonComplete(lesson.lessonId!, course.id)
      if (!res?.error) {
        setCompleted(true)
        // Refresh so the next item unlocks from server-computed state.
        router.refresh()
      }
    })
  }

  // Link target for the "next" control based on the next item in sequence.
  const nextHref = nextItem
    ? nextItem.kind === 'lesson'
      ? `/student/courses/${course.id}/lessons/${nextItem.lesson.id}`
      : `/student/assignments/${nextItem.assignment.id}`
    : undefined
  const nextLabel = nextItem
    ? nextItem.kind === 'lesson'
      ? 'الدرس التالي'
      : 'الواجب التالي'
    : undefined
  // The next item only opens once the current lesson is completed.
  const nextEnabled = !!nextItem && completed

  const prevHref = prevItem
    ? prevItem.kind === 'lesson'
      ? `/student/courses/${course.id}/lessons/${prevItem.lesson.id}`
      : `/student/assignments/${prevItem.assignment.id}`
    : undefined

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/student/courses/${course.id}`}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <ArrowRight className="size-4" />
          {course.title}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Player + content */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="overflow-hidden p-0">
            <div className="relative aspect-video w-full bg-black">
              {lesson.type === 'فيديو' ? (
                <VideoPlayer key={lesson.id} src={lesson.videoUrl} poster={course.image} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
                  <FileText className="size-12" />
                  <p className="text-sm">هذا الدرس عبارة عن محتوى نصي</p>
                </div>
              )}
            </div>
          </Card>

          {/* Lesson info */}
          <Card className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="text-xs font-semibold text-primary">
                  الدرس {index + 1} من {all.length}
                </span>
                <h1 className="mt-1 text-xl font-bold text-foreground text-balance">
                  {lesson.title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lesson.type} • {lesson.duration}
                </p>
              </div>
              <Button
                variant={completed ? 'outline' : 'default'}
                onClick={markComplete}
                disabled={isPending}
                className={cn('shrink-0', completed && 'border-primary text-primary')}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {completed ? 'تم الإكمال' : 'وضع كمكتمل'}
              </Button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {lesson.description}
            </p>

            {/* Attachments */}
            {lesson.attachments && lesson.attachments.length > 0 && (
              <div className="mt-5 border-t border-border pt-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Paperclip className="size-4 text-primary" />
                  مرفقات الدرس
                </p>
                <ul className="space-y-2">
                  {lesson.attachments.map((att, i) => {
                    const Icon = att.type === 'image' ? FileImage : FileText
                    return (
                      <li key={i}>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.name}
                          className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm transition-colors hover:bg-secondary"
                        >
                          <Icon className="size-4 shrink-0 text-primary" />
                          <span className="flex-1 truncate font-medium text-foreground">
                            {att.name}
                          </span>
                          <Download className="size-4 shrink-0 text-muted-foreground" />
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </Card>

          {/* Next-up assignment callout */}
          {nextItem?.kind === 'assignment' && (
            <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ClipboardList className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    الواجب التالي: {nextItem.assignment.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {completed
                      ? 'أكملت الدرس، يمكنك الآن حلّ الواجب.'
                      : 'أكمل هذا الدرس أولاً لفتح الواجب.'}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                disabled={!nextEnabled}
                className="shrink-0"
                nativeButton={!nextEnabled}
                render={
                  nextEnabled ? (
                    <Link href={`/student/assignments/${nextItem.assignment.id}`} />
                  ) : undefined
                }
              >
                فتح الواجب
                <ChevronLeft className="size-4" />
              </Button>
            </Card>
          )}

          {/* Prev / Next */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={!prevHref}
              className="gap-1"
              nativeButton={!prevHref}
              render={prevHref ? <Link href={prevHref} /> : undefined}
            >
              <ChevronRight className="size-4" />
              السابق
            </Button>
            <Button
              disabled={!nextEnabled || nextItem?.kind === 'assignment'}
              className="gap-1"
              nativeButton={!(nextEnabled && nextItem?.kind === 'lesson' && nextHref)}
              render={
                nextEnabled && nextItem?.kind === 'lesson' && nextHref ? (
                  <Link href={nextHref} />
                ) : undefined
              }
            >
              {nextLabel ?? 'إنهاء'}
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>

        {/* Playlist sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-base font-bold text-foreground">محتوى المحاضرة</h2>
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{courseProgress}% مكتمل</span>
                <span className="text-muted-foreground">
                  {all.filter((l) => l.completed).length}/{all.length}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${courseProgress}%` }}
                />
              </div>
            </div>
          </Card>

          <Card className="p-0">
            <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto scrollbar-hide">
              {items.map((it) => {
                if (it.kind === 'lesson') {
                  const l = it.lesson
                  const active = l.id === lesson.id
                  const Icon = active ? PlayCircle : lessonIcon(l)
                  const content = (
                    <div
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors',
                        active && 'bg-primary/5',
                        l.locked
                          ? 'cursor-not-allowed opacity-60'
                          : 'hover:bg-secondary/40',
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-5 shrink-0',
                          l.completed || active
                            ? 'text-primary'
                            : l.locked
                              ? 'text-muted-foreground'
                              : 'text-foreground',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm',
                            active
                              ? 'font-semibold text-foreground'
                              : 'font-medium text-foreground',
                          )}
                        >
                          {l.title}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          درس · {l.duration}
                        </span>
                      </div>
                    </div>
                  )
                  return (
                    <li key={l.id}>
                      {l.locked ? (
                        content
                      ) : (
                        <Link href={`/student/courses/${course.id}/lessons/${l.id}`}>
                          {content}
                        </Link>
                      )}
                    </li>
                  )
                }

                // Assignment row
                const a = it.assignment
                const locked = a.locked
                const content = (
                  <div
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 transition-colors',
                      locked ? 'cursor-not-allowed opacity-60' : 'hover:bg-secondary/40',
                    )}
                  >
                    {locked ? (
                      <Lock className="size-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ClipboardList className="size-5 shrink-0 text-primary" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {a.title}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        واجب
                        {a.questions?.length ? ` · ${a.questions.length} سؤال` : ''}
                      </span>
                    </div>
                  </div>
                )
                return (
                  <li key={a.id}>
                    {locked ? (
                      content
                    ) : (
                      <Link href={`/student/assignments/${a.id}`}>{content}</Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
