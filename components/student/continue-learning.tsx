import Image from 'next/image'
import Link from 'next/link'
import { Play, BookOpen } from 'lucide-react'
import { PanelCard } from '@/components/dashboard/panel-card'
import type { CourseProgress } from '@/lib/student-types'

export function ContinueLearning({ courses = [] }: { courses?: CourseProgress[] }) {
  const course = courses[0]

  if (!course) {
    return (
      <PanelCard title="أكمل من حيث توقفت">
        <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <BookOpen className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">لا توجد كورسات مسجّلة بعد</p>
            <p className="mt-1 text-xs text-muted-foreground">تصفّح المكتبة وابدأ رحلتك التعليمية</p>
          </div>
          <Link
            href="/student/browse"
            className="inline-flex h-8 items-center justify-center rounded-xl border border-border bg-secondary/60 px-3 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            تصفّح المحاضرات
          </Link>
        </div>
      </PanelCard>
    )
  }

  const percent = course.totalLessons > 0
    ? Math.round((course.completedLessons / course.totalLessons) * 100)
    : 0

  return (
    <PanelCard title="أكمل من حيث توقفت">
      <div className="flex h-full flex-col gap-4 sm:flex-row">
        <div className="relative w-full shrink-0 overflow-hidden rounded-xl sm:w-56">
          <Image
            src={course.image || '/placeholder.svg'}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 100vw, 224px"
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex size-12 items-center justify-center rounded-full bg-white/90 text-sidebar">
              <Play className="size-5 fill-current" />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="text-xs font-medium text-primary">{course.category}</span>
          <h4 className="mt-1 text-base font-bold text-foreground">{course.title}</h4>
          {course.nextLesson && (
            <p className="mt-1 text-sm text-muted-foreground">
              الدرس التالي: {course.nextLesson}
            </p>
          )}

          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{percent}% مكتمل</span>
              <span className="text-muted-foreground">
                {course.completedLessons} / {course.totalLessons} درس
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <Link
            href={`/student/courses/${course.id}`}
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Play className="size-4" />
            متابعة الدرس
          </Link>
        </div>
      </div>
    </PanelCard>
  )
}
