'use client'

import Link from 'next/link'
import { Flame, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStudent } from '@/components/student/student-context'

export function StudentWelcome({
  completionPercent,
  avgGrade,
  streak,
  lessonsThisWeek,
  examsThisWeek,
}: {
  completionPercent: number
  avgGrade: number | null
  streak: number
  lessonsThisWeek: number
  examsThisWeek: number
}) {
  const { profile } = useStudent()

  // Build a natural Arabic summary of what's due this week.
  const parts: string[] = []
  if (lessonsThisWeek > 0) {
    parts.push(`${lessonsThisWeek} ${lessonsThisWeek === 1 ? 'درس' : 'دروس'}`)
  }
  if (examsThisWeek > 0) {
    parts.push(`${examsThisWeek} ${examsThisWeek === 1 ? 'اختبار' : 'اختبارات'}`)
  }
  const summary =
    parts.length > 0
      ? `لديك ${parts.join(' و ')} هذا الأسبوع. استمر في التقدّم لتحافظ على تفوقك!`
      : 'لا مهام مجدولة هذا الأسبوع. استغل الوقت لمراجعة دروسك السابقة!'

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-primary dark:bg-transparent bg-gradient-to-l from-transparent to-black/20 dark:from-primary dark:via-primary/80 dark:to-primary/60 p-6 text-white shadow-xl shadow-primary/20 dark:shadow-none sm:flex-row sm:items-center sm:justify-between transition-colors duration-300">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-white/20 dark:bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 size-64 rounded-full bg-black/10 dark:bg-black/30 blur-3xl" />

      <div className="relative z-10 text-right">
        <p className="text-sm text-white/80">
          أهلاً بعودتك <span aria-hidden="true">👋</span>
        </p>
        <h2 className="mt-1 text-2xl font-bold">{profile.name}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
          {summary}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            nativeButton={false}
            render={<Link href="/student/courses" />}
            className="shrink-0 whitespace-nowrap bg-white text-primary hover:bg-white/90 shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            <Play className="size-4" />
            متابعة التعلّم
          </Button>
          {streak > 0 && (
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-white/20 px-3 py-2 text-sm font-medium backdrop-blur-sm">
              <Flame className="size-4 text-amber-400 drop-shadow-md" />
              <span>
                {streak} {streak === 1 ? 'يوم متتالي' : 'أيام متتالية'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-6 rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-md border border-white/10 shadow-inner">
        <div className="text-center">
          <p className="text-3xl font-bold">{completionPercent}%</p>
          <p className="mt-1 text-xs text-white/60">نسبة الإنجاز</p>
        </div>
        <div className="h-12 w-px bg-white/15" />
        <div className="text-center">
          <p className="text-3xl font-bold">
            {avgGrade != null ? `${avgGrade}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-white/60">متوسط الدرجات</p>
        </div>
      </div>
    </div>
  )
}
