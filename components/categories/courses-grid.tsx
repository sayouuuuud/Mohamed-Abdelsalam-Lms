'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Pencil, Trash2, Plus, BookOpen, EyeOff, ChevronDown, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useCurriculum } from './curriculum-context'
import type { AdminBranch, AdminStage } from '@/app/admin/categories/actions'

function formatEGP(value: number) {
  return value.toLocaleString('en-US')
}

export function CoursesGrid() {
  const { stages, openCreateCourse, openEditCourse, requestDeleteCourse } =
    useCurriculum()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

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
                <p className="text-xs font-bold text-muted-foreground">
                  {stage.title}
                </p>
                <h3 className="mt-0.5 text-base font-bold text-foreground">
                  {branch.title}
                </h3>
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
                <div
                  key={course.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
                >
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
                    <h4 className="text-sm font-bold text-foreground">
                      {course.title}
                    </h4>
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {course.description || 'بدون وصف'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="secondary" className="gap-1">
                        <BookOpen className="size-3" />
                        {course.lectureCount} محاضرة
                      </Badge>
                      <Badge variant="secondary">
                        {formatEGP(course.price)} ج.م
                      </Badge>
                      {course.oldPrice != null && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatEGP(course.oldPrice)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggle(course.id)}
                      disabled={course.lectureCount === 0}
                      aria-expanded={!!expanded[course.id]}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors',
                        course.lectureCount === 0
                          ? 'cursor-not-allowed text-muted-foreground opacity-60'
                          : 'text-foreground hover:bg-secondary',
                      )}
                    >
                      <span>
                        {course.lectureCount === 0
                          ? 'لا توجد محاضرات بعد'
                          : `عرض المحاضرات (${course.lectureCount})`}
                      </span>
                      {course.lectureCount > 0 && (
                        <ChevronDown
                          className={cn(
                            'size-4 transition-transform',
                            expanded[course.id] && 'rotate-180',
                          )}
                        />
                      )}
                    </button>

                    {expanded[course.id] && course.lectures.length > 0 && (
                      <ol className="flex flex-col gap-1 rounded-lg bg-secondary/50 p-2">
                        {course.lectures.map((lecture, index) => (
                          <li
                            key={lecture.id}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground"
                          >
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-bold text-muted-foreground">
                              {index + 1}
                            </span>
                            <PlayCircle className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="line-clamp-1">{lecture.title}</span>
                          </li>
                        ))}
                      </ol>
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
              ))}
            </div>
          </Card>
        ),
      )}
    </div>
  )
}
