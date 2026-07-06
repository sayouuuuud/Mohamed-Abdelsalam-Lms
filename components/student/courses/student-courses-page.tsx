'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, CheckCircle2, Clock, Play, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStudent } from '@/components/student/student-context'

type Filter = 'all' | 'in-progress' | 'completed'

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'in-progress', label: 'قيد التقدّم' },
  { key: 'completed', label: 'مكتملة' },
]

export function StudentCoursesPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const { enrolledCourses = [] } = useStudent()

  const withPercent = enrolledCourses.map((c: any) => ({
    ...c,
    percent: c.totalLessons ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0,
    rating: c.rating || 4.5,
    durationHours: c.durationHours || 12,
  }))

  const filtered = withPercent.filter((c) => {
    if (filter === 'completed') return c.percent === 100
    if (filter === 'in-progress') return c.percent < 100
    return true
  })

  const totalLessons = withPercent.reduce((a, c) => a + c.totalLessons, 0)
  const completedLessons = withPercent.reduce((a, c) => a + c.completedLessons, 0)
  const completedCourses = withPercent.filter((c) => c.percent === 100).length

  const stats = [
    { label: 'إجمالي المحاضرات', value: withPercent.length, icon: BookOpen },
    { label: 'كورسات مكتملة', value: completedCourses, icon: CheckCircle2 },
    {
      label: 'دروس أكملتها',
      value: `${completedLessons}/${totalLessons}`,
      icon: Clock,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">كورساتي</h1>
        <p className="text-sm text-muted-foreground">
          تابع تقدّمك في المحاضرات المسجّلة وأكمل رحلتك التعليمية.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="flex flex-row items-center gap-4 p-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
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
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:bg-secondary',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <BookOpen className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">لا توجد كورسات في هذا التصنيف.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <Card key={course.id} className="group flex flex-col p-0">
              <Link
                href={`/student/courses/${course.id}`}
                className="relative aspect-video w-full overflow-hidden"
              >
                <Image
                  src={course.image || '/placeholder.svg'}
                  alt={course.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute right-3 top-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                  {course.category}
                </span>
              </Link>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="line-clamp-2 text-base font-bold leading-snug text-foreground">
                  {course.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {course.instructor}
                </p>

                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {course.rating}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {course.durationHours} ساعة
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="size-3.5" />
                    {course.totalLessons} درس
                  </span>
                </div>

                <div className="mt-auto pt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {course.percent}% مكتمل
                    </span>
                    <span className="text-muted-foreground">
                      {course.completedLessons}/{course.totalLessons}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${course.percent}%` }}
                    />
                  </div>

                  <Button
                    className="mt-4 w-full"
                    nativeButton={false}
                    render={<Link href={`/student/courses/${course.id}`} />}
                  >
                    <Play className="size-4" />
                    {course.percent === 100 ? 'مراجعة الكورس' : 'متابعة التعلّم'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
