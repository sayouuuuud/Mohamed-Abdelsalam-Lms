'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  PlayCircle,
  Lock,
  Layers,
  GitBranch,
  ArrowLeft,
  Film,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLectures } from './lectures-context'

export function LecturesGrid() {
  const {
    lectures,
    openEditLecture,
    requestDeleteLecture,
    openCreateLesson,
    openEditLesson,
    requestDeleteLesson,
  } = useLectures()

  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('الكل')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const stages = useMemo(() => {
    const set = new Map<string, string>()
    for (const l of lectures) if (l.stageId) set.set(l.stageId, l.stageTitle)
    return Array.from(set, ([id, title]) => ({ id, title }))
  }, [lectures])

  const filtered = useMemo(() => {
    const q = query.trim()
    return lectures.filter((l) => {
      const matchesStage = stageFilter === 'الكل' || l.stageId === stageFilter
      const matchesQuery =
        q === '' ||
        l.title.includes(q) ||
        l.branchTitle.includes(q) ||
        l.stageTitle.includes(q)
      return matchesStage && matchesQuery
    })
  }, [lectures, query, stageFilter])

  return (
    <Card className="gap-0 p-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالمحاضرة أو الفرع أو المرحلة..."
            className="h-11 w-full rounded-xl border border-border bg-secondary/60 pr-10 pl-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStageFilter('الكل')}
            className={cn(
              'rounded-lg border px-4 py-2 text-xs font-semibold transition-colors',
              stageFilter === 'الكل'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
            )}
          >
            كل المراحل
          </button>
          {stages.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStageFilter(s.id)}
              className={cn(
                'rounded-lg border px-4 py-2 text-xs font-semibold transition-colors',
                stageFilter === s.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          لا توجد محاضرات مطابقة لبحثك
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {filtered.map((lecture) => {
            const isOpen = expanded[lecture.id] ?? false
            return (
              <div
                key={lecture.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                {/* Lecture row */}
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-1 items-start gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [lecture.id]: !isOpen }))
                      }
                      className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary"
                      aria-label={isOpen ? 'طي الدروس' : 'عرض الدروس'}
                    >
                      <ChevronDown
                        className={cn(
                          'size-4 transition-transform',
                          isOpen ? '' : '-rotate-90',
                        )}
                      />
                    </button>
                    
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/50 sm:h-20 sm:w-32">
                      {lecture.image ? (
                        <img
                          src={lecture.image}
                          alt={lecture.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                          <Layers className="size-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-foreground truncate">
                          {lecture.title}
                        </h3>
                        {lecture.badge && (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                          >
                            {lecture.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground line-clamp-2">
                        {lecture.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
                          <span className="font-medium text-foreground">
                            {lecture.lessons.length}
                          </span>
                          درس
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
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      className="h-8"
                      nativeButton={false}
                      render={<Link href={`/admin/courses/${lecture.id}`} />}
                    >
                      عرض التفاصيل
                      <ArrowLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => openEditLecture(lecture)}
                    >
                      <Pencil className="size-4" />
                      تعديل
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
                      onClick={() => requestDeleteLecture(lecture)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">حذف المحاضرة</span>
                    </Button>
                  </div>
                </div>

                {/* Lessons */}
                {isOpen && (
                  <div className="space-y-2 border-t border-border bg-secondary/30 p-4">
                    {lecture.lessons.length === 0 ? (
                      <p className="py-3 text-center text-sm text-muted-foreground">
                        لا توجد دروس في هذه المحاضرة بعد.
                      </p>
                    ) : (
                      lecture.lessons.map((lesson, i) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5"
                        >
                          <Link
                            href={`/admin/courses/${lecture.id}/lessons/${lesson.id}`}
                            className="flex flex-1 items-center gap-3"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                              {i + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
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
                                {lesson.videoUrl ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                                    <Film className="size-3" /> فيديو
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-rose-500">
                                    بدون فيديو
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {lesson.duration}
                              </span>
                            </div>
                          </Link>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditLesson(lecture.id, lesson)}
                            >
                              <Pencil className="size-3.5" />
                              <span className="sr-only">تعديل الدرس</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                              onClick={() => requestDeleteLesson(lesson)}
                            >
                              <Trash2 className="size-3.5" />
                              <span className="sr-only">حذف الدرس</span>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => openCreateLesson(lecture.id)}
                    >
                      <Plus className="size-4" />
                      إضافة درس
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
