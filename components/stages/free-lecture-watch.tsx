'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Play, CheckCircle2, Paperclip, Sparkles } from 'lucide-react'
import { VideoPlayer } from '@/components/student/courses/video-player'
import { cn } from '@/lib/utils'
import type { FreeLectureWatch as FreeLectureWatchData } from '@/lib/free-lecture-data'

export function FreeLectureWatch({
  data,
  backHref,
}: {
  data: FreeLectureWatchData
  backHref: string
}) {
  const { stage, branch, course, lecture, lessons } = data
  const [activeId, setActiveId] = useState(lessons[0]?.id ?? '')
  const active = lessons.find((l) => l.id === activeId) ?? lessons[0]

  return (
    <main className="min-h-screen bg-cream pt-20 dark:bg-ink-base">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        {/* breadcrumb */}
        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-soft dark:text-ink-dim">
          <Link href={`/stages/${stage.id}/${branch.id}`} className="transition-colors hover:text-emerald-deep dark:hover:text-teal-glow">
            {branch.title}
          </Link>
          <ArrowRight className="size-3.5" />
          <Link href={backHref} className="transition-colors hover:text-emerald-deep dark:hover:text-teal-glow">
            {course.title}
          </Link>
          <ArrowRight className="size-3.5" />
          <span className="text-navy dark:text-ink-fg">{lecture.title}</span>
        </nav>

        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-brand/15 px-3 py-1 text-xs font-bold text-emerald-deep dark:bg-teal-glow/15 dark:text-teal-glow">
          <Sparkles className="size-3.5" />
          محاضرة مجانية — متاحة للجميع
        </div>

        {lessons.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white p-10 text-center text-navy-soft dark:border-ink-line dark:bg-ink-raised dark:text-ink-dim">
            لم تتم إضافة دروس لهذه المحاضرة حتى الآن.
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
            {/* Player + details */}
            <div className="flex flex-col gap-4">
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-navy/10 bg-black dark:border-ink-line">
                <VideoPlayer key={active?.id} src={active?.videoUrl} />
              </div>

              <div className="rounded-2xl border border-navy/10 bg-white p-5 dark:border-ink-line dark:bg-ink-raised">
                <h1 className="font-heading text-xl font-bold text-navy dark:text-ink-fg">
                  {active?.title}
                </h1>
                {active?.description && (
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-navy-soft dark:text-ink-dim">
                    {active.description}
                  </p>
                )}

                {active && active.attachments.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-navy/10 pt-4 dark:border-ink-line">
                    <span className="text-xs font-bold text-navy dark:text-ink-fg">مرفقات الدرس</span>
                    {active.attachments.map((att) => (
                      <a
                        key={att.url}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center gap-2 rounded-lg bg-cream px-3 py-2 text-sm font-semibold text-emerald-deep transition-colors hover:bg-cream/70 dark:bg-ink-base dark:text-teal-glow"
                      >
                        <Paperclip className="size-4" />
                        {att.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Lessons list */}
            <aside className="flex flex-col gap-3">
              <div className="rounded-2xl border border-navy/10 bg-white p-4 dark:border-ink-line dark:bg-ink-raised">
                <h2 className="mb-3 font-heading text-base font-bold text-navy dark:text-ink-fg">
                  دروس المحاضرة ({lessons.length})
                </h2>
                <ul className="flex flex-col gap-1.5">
                  {lessons.map((lesson, i) => {
                    const isActive = lesson.id === activeId
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => setActiveId(lesson.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors',
                            isActive
                              ? 'bg-emerald-deep text-cream dark:bg-teal-glow dark:text-ink-base'
                              : 'hover:bg-cream dark:hover:bg-ink-base',
                          )}
                        >
                          <span
                            className={cn(
                              'grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold',
                              isActive
                                ? 'bg-white/20 text-cream dark:bg-ink-base/20 dark:text-ink-base'
                                : 'bg-emerald-brand/15 text-emerald-deep dark:bg-teal-glow/15 dark:text-teal-glow',
                            )}
                          >
                            {isActive ? <Play className="size-3.5" /> : i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block truncate text-sm font-semibold',
                                isActive ? 'text-cream dark:text-ink-base' : 'text-navy dark:text-ink-fg',
                              )}
                            >
                              {lesson.title}
                            </span>
                            {lesson.duration && (
                              <span
                                className={cn(
                                  'text-xs',
                                  isActive ? 'text-cream/80 dark:text-ink-base/80' : 'text-navy-soft dark:text-ink-dim',
                                )}
                              >
                                {lesson.duration}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <Link
                href={backHref}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-navy/15 px-5 py-3 text-sm font-bold text-navy transition-colors hover:bg-navy/5 dark:border-ink-line dark:text-ink-fg dark:hover:bg-ink-raised"
              >
                <ArrowRight className="size-4" />
                رجوع لصفحة الكورس
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}
