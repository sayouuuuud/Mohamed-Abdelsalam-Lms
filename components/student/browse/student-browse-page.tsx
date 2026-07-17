'use client'

import Image from 'next/image'
import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  BookOpen,
  Check,
  Lock,
  Play,
  Plus,
  PlayCircle,
  Search,
  ShoppingCart,
  X,
  ChevronDown,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useCart } from '@/components/cart/cart-provider'
import type { Stage, Lesson } from '@/lib/landing-data'

function formatEGP(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value)
}

// Groups a course's lectures by their section, preserving section order and
// placing any unclassified lectures in a trailing "بدون تصنيف" group. When the
// course has no sections at all, returns a single untitled group.
function groupLecturesBySection(course: FlatCourse) {
  const groups: { id: string | null; title: string | null; lectures: FlatLecture[] }[] = []
  if (!course.sections || course.sections.length === 0) {
    return [{ id: null, title: null, lectures: course.lectures }]
  }
  for (const section of course.sections) {
    const lectures = course.lectures.filter((l) => l.sectionId === section.id)
    if (lectures.length > 0) groups.push({ id: section.id, title: section.title, lectures })
  }
  const unclassified = course.lectures.filter(
    (l) => !l.sectionId || !course.sections.some((s) => s.id === l.sectionId),
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

type FlatCourse = {
  dbId?: string
  slug: string
  image?: string
  title: string
  description: string
  price: number
  oldPrice?: number
  badge?: string
  lectures: FlatLecture[]
  sections: { id: string; title: string }[]
  stageTitle: string
  branchTitle: string
  stageId: string
  branchId: string
}

type FlatLecture = {
  dbId?: string
  slug: string
  image?: string
  title: string
  description: string
  price: number
  oldPrice?: number
  badge?: string
  isFree?: boolean
  lessonsCount: number
  lessons: Lesson[]
  sectionId?: string | null
  stageTitle: string
  branchTitle: string
  stageId: string
  branchId: string
  courseId: string
}

export function StudentBrowsePage({
  stages = [],
  gradeLocked = false,
  purchasedCourseIds = [],
}: {
  stages?: Stage[]
  gradeLocked?: boolean
  purchasedCourseIds?: string[]
}) {
  const searchParams = useSearchParams()
  const { add, addCourse, inCart, courseInCart, setOpen, count } = useCart()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [stageFilter, setStageFilter] = useState<string>('all')

  // Keep local query in sync when the URL param changes (e.g. search from header).
  useEffect(() => {
    setQuery(searchParams.get('q') || '')
  }, [searchParams])
  const [courseDetails, setCourseDetails] = useState<FlatCourse | null>(null)

  // Flatten the curriculum tree into a searchable list of monthly courses.
  // Lectures that aren't linked to any course are intentionally hidden here —
  // the student portal now browses by course only.
  const courses = useMemo<FlatCourse[]>(() => {
    const out: FlatCourse[] = []
    for (const stage of stages) {
      for (const branch of stage.branches) {
        for (const course of branch.monthlyCourses ?? []) {
          out.push({
            dbId: course.dbId,
            slug: course.id,
            image: course.image,
            title: course.title,
            description: course.description,
            price: course.price,
            oldPrice: course.oldPrice,
            badge: course.badge,
            stageTitle: stage.title,
            branchTitle: branch.title,
            stageId: stage.id,
            branchId: branch.id,
            sections: course.sections ?? [],
            lectures: course.lectures.map((lecture) => ({
              dbId: lecture.dbId,
              slug: lecture.id,
              image: lecture.image,
              title: lecture.title,
              description: lecture.description,
              price: lecture.price,
              oldPrice: lecture.oldPrice,
              badge: lecture.badge,
              isFree: lecture.isFree,
              lessonsCount: lecture.lessons.length,
              lessons: lecture.lessons,
              sectionId: lecture.sectionId ?? null,
              stageTitle: stage.title,
              branchTitle: branch.title,
              stageId: stage.id,
              branchId: branch.id,
              courseId: course.id,
            })),
          })
        }
      }
    }
    return out
  }, [stages])

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase()
    return courses.filter((course) => {
      if (stageFilter !== 'all' && course.stageTitle !== stageFilter) return false
      if (!q) return true
      const matchesCourse =
        course.title.toLowerCase().includes(q) ||
        course.branchTitle.toLowerCase().includes(q) ||
        course.stageTitle.toLowerCase().includes(q) ||
        (course.description ?? '').toLowerCase().includes(q)
      const matchesLecture = course.lectures.some((l) =>
        l.title.toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q),
      )
      return matchesCourse || matchesLecture
    })
  }, [courses, query, stageFilter])

  const stageNames = useMemo(() => stages.map((s) => s.title), [stages])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">تصفّح الكورسات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {gradeLocked
              ? `كورسات ${stages[0]?.title ?? 'صفّك'} — اختار الكورس اللي محتاجه وضيفه للسلة.`
              : 'اختار الكورس اللي محتاجه، اتفرّج على محاضراته، وضيفه للسلة كامل.'}
          </p>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ShoppingCart className="size-4" />
            السلة ({count})
          </button>
        )}
      </div>

      {/* Search + stage filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن كورس أو فرع..."
            className="h-11 w-full rounded-xl border border-border bg-secondary/50 pr-9 pl-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
          />
        </div>
        {!gradeLocked && (
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="الكل"
              active={stageFilter === 'all'}
              onClick={() => setStageFilter('all')}
            />
            {stageNames.map((name) => (
              <FilterChip
                key={name}
                label={name}
                active={stageFilter === name}
                onClick={() => setStageFilter(name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Courses grid */}
      {filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground"><BookOpen className="size-6" /></div>
          <p className="text-sm text-muted-foreground">مفيش كورسات مطابقة لبحثك حاليًا.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCourses.map((course) => {
            const added = course.dbId ? courseInCart(course.dbId) : false
            const lessonsCount = course.lectures.reduce((sum, lecture) => sum + lecture.lessonsCount, 0)
            return (
              <article key={course.dbId ?? course.slug} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md">
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <Image src={course.image || course.lectures[0]?.image || '/lessons/complex-numbers.png'} alt={course.title} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                  <span className="absolute right-3 top-3 rounded-lg bg-card/90 px-2 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur">{course.stageTitle}</span>
                  {course.badge && <span className="absolute left-3 top-3 rounded-lg bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">{course.badge}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-primary">{course.branchTitle}</p>
                    <h2 className="text-lg font-bold text-foreground">{course.title}</h2>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="rounded-lg bg-muted px-2.5 py-1.5">{course.lectures.length} محاضرة</span>
                    <span className="rounded-lg bg-muted px-2.5 py-1.5">{lessonsCount} درس</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCourseDetails(course)}
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg text-xs font-semibold text-primary transition-colors hover:underline"
                  >
                    <PlayCircle className="size-3.5" />
                    عرض محاضرات الكورس
                  </button>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="flex items-baseline gap-1.5">
                      {course.price === 0 ? (
                        <strong className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">مجاناً</strong>
                      ) : (
                        <>
                          <strong className="text-lg font-extrabold text-foreground">{formatEGP(course.price)}</strong>
                          <span className="text-xs font-bold text-primary">ج.م</span>
                          {course.oldPrice && <span className="text-xs text-muted-foreground line-through">{formatEGP(course.oldPrice)}</span>}
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={added || !course.dbId}
                      onClick={() => course.dbId && addCourse(course.dbId, course.title)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors',
                        added ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-primary text-primary-foreground hover:opacity-90',
                      )}
                    >
                      {added ? (<><Check className="size-4" />في السلة</>) : course.price === 0 ? (<><Plus className="size-4" />احصل عليه مجاناً</>) : (<><Plus className="size-4" />أضف للسلة</>)}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {courseDetails && (
        <CourseDetailsModal
          course={courseDetails}
          inCart={courseDetails.dbId ? courseInCart(courseDetails.dbId) : false}
          onAddCourse={() => courseDetails.dbId && addCourse(courseDetails.dbId, courseDetails.title)}
          onClose={() => setCourseDetails(null)}
          purchasedCourseIds={purchasedCourseIds}
        />
      )}

    </div>
  )
}

function CourseDetailsModal({ course, inCart, onAddCourse, onClose, purchasedCourseIds }: {
  course: FlatCourse
  inCart: boolean
  onAddCourse: () => void
  onClose: () => void
  purchasedCourseIds: string[]
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const isCoursePurchased = course.dbId ? purchasedCourseIds.includes(course.dbId) : false
  const { add, inCart: lectureInCart } = useCart()

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" aria-label="إغلاق" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <section className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl" aria-labelledby="course-details-title">
        <header className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-primary">{course.stageTitle} · {course.branchTitle}</p>
            <h2 id="course-details-title" className="text-xl font-bold text-foreground">{course.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{course.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-foreground"><X className="size-4" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <h3 className="text-sm font-bold text-foreground">محتوى الكورس ({course.lectures.length} محاضرة)</h3>
          {groupLecturesBySection(course).map((group) => (
            <div key={group.id ?? 'no-section'} className="flex flex-col gap-2">
              {group.title && (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-primary" />
                  <h4 className="text-sm font-bold text-foreground">{group.title}</h4>
                  <span className="text-xs text-muted-foreground">({group.lectures.length})</span>
                </div>
              )}
              {group.lectures.map((lecture, index) => {
                const isOpen = expanded[lecture.dbId ?? lecture.slug] ?? false
                // A lecture is free only when explicitly marked isFree.
                // course.price === 0 means the whole bundle is free to purchase,
                // not that individual lectures inside it are free to preview.
                const isLectureFree = lecture.isFree
                const isFreeAccess = isLectureFree || isCoursePurchased
                const addedLecture = lecture.dbId ? lectureInCart(lecture.dbId) : false
                
                return (
                  <div key={lecture.dbId ?? lecture.slug} className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex w-full items-center justify-between gap-4 p-4 transition-colors hover:bg-muted">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 font-bold text-primary">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-bold text-foreground flex items-center gap-2">
                            {lecture.title}
                            {isLectureFree && (
                              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                                مجانية
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{lecture.lessonsCount} درس</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCoursePurchased ? (
                          <Link
                            href={`/student/courses/${course.dbId}/lessons/${lecture.lessons[0]?.id}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                          >
                            <Play className="size-3.5" />
                            شاهد المحاضرة
                          </Link>
                        ) : isLectureFree ? (
                          <Link
                            href={`/stages/${lecture.stageId}/${lecture.branchId}/${lecture.courseId}/watch/${lecture.slug}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                          >
                            <Play className="size-3.5" />
                            شاهد مجاناً
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3">
                            {lecture.price === 0 ? (
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">مجاناً</span>
                            ) : (
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-bold text-foreground">{formatEGP(lecture.price)}</span>
                                <span className="text-[10px] text-muted-foreground">ج.م</span>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={addedLecture || !lecture.dbId}
                              onClick={() => lecture.dbId && add(lecture.dbId, lecture.title)}
                              className={cn(
                                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                                addedLecture
                                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : lecture.price === 0
                                    ? "border-emerald-500/50 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                                    : "border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                              )}
                            >
                              {addedLecture ? <Check className="size-3.5" /> : lecture.price === 0 ? <Plus className="size-3.5" /> : <ShoppingCart className="size-3.5" />}
                              {addedLecture ? 'في السلة' : lecture.price === 0 ? 'احصل عليها' : 'السلة'}
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [lecture.dbId ?? lecture.slug]: !isOpen,
                            }))
                          }
                          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                        >
                          <ChevronDown
                            className={cn(
                              'size-5 transition-transform',
                              isOpen ? 'rotate-180' : '',
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-border bg-secondary/30 p-4">
                        <ul className="space-y-1">
                          {lecture.lessons.map((lesson, i) => {
                            const isLessonFreeAccess = lesson.isFree || isFreeAccess
                            return (
                              <li
                                key={lesson.id}
                                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60"
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={cn(
                                      'grid size-8 shrink-0 place-items-center rounded-lg',
                                      isLessonFreeAccess
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-secondary text-muted-foreground',
                                    )}
                                  >
                                    {isLessonFreeAccess ? <Play className="size-3.5" /> : <Lock className="size-3.5" />}
                                  </span>
                                  <div>
                                    <span className="block text-sm font-semibold text-foreground">
                                      {i + 1}. {lesson.title}
                                    </span>
                                    {isLessonFreeAccess && !isCoursePurchased && (
                                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        معاينة مجانية
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                  {lesson.duration}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        {!isCoursePurchased && (
          <footer className="flex items-center justify-between gap-3 border-t border-border p-4">
            <div>
              {course.price === 0 ? (
                <strong className="text-xl text-emerald-600 dark:text-emerald-400">مجاناً</strong>
              ) : (
                <>
                  <strong className="text-xl text-foreground">{formatEGP(course.price)}</strong>
                  <span className="text-xs font-bold text-primary">ج.م</span>
                </>
              )}
            </div>
            <button type="button" disabled={inCart || !course.dbId} onClick={onAddCourse} className={cn('rounded-full px-5 py-2.5 text-sm font-bold', inCart ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground transition-opacity hover:opacity-90')}>
              {inCart ? 'الباقة في السلة' : course.price === 0 ? 'اشترِ الكورس مجاناً' : 'اشترِ الكورس كاملًا'}
            </button>
          </footer>
        )}
      </section>
    </div>
  )
}

function LectureDetailsModal({
  lecture,
  inCart,
  onAdd,
  onClose,
}: {
  lecture: FlatLecture
  inCart: boolean
  onAdd: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
        {/* artwork header */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-gradient-to-br from-secondary to-muted">
          <Image
            src={lecture.image || `/lessons/${lecture.slug}.png`}
            alt={lecture.title}
            fill
            sizes="512px"
            className="object-cover"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-3 grid size-9 place-items-center rounded-full bg-background/90 text-foreground shadow transition-colors hover:bg-background"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
          {lecture.badge && (
            <span className="absolute right-3 top-3 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow">
              {lecture.badge}
            </span>
          )}
        </div>

        {/* body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
          <span className="text-xs font-semibold text-primary">
            {lecture.stageTitle} · {lecture.branchTitle}
          </span>
          <h2 className="mt-1 text-xl font-bold text-foreground">{lecture.title}</h2>
          {lecture.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {lecture.description}
            </p>
          )}

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-bold text-foreground">
              محتوى المحاضرة ({lecture.lessonsCount} درس)
            </h3>
            <ul className="space-y-1">
              {lecture.lessons.map((lesson, i) => {
                const isFreeAccess = !!lesson.isFree
                return (
                  <li
                    key={lesson.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-lg',
                          isFreeAccess
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {isFreeAccess ? <Play className="size-3.5" /> : <Lock className="size-3.5" />}
                      </span>
                      <div>
                        <span className="block text-sm font-semibold text-foreground">
                          {i + 1}. {lesson.title}
                        </span>
                        {isFreeAccess && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            معاينة مجانية
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {lesson.duration}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* footer CTA */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border p-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-foreground">
              {formatEGP(lecture.price)}
            </span>
            <span className="text-xs font-bold text-primary">ج.م</span>
            {lecture.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatEGP(lecture.oldPrice)}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={inCart || !lecture.dbId}
            onClick={onAdd}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold transition-colors',
              inCart
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-primary text-primary-foreground hover:opacity-90',
            )}
          >
            {inCart ? (
              <>
                <Check className="size-4" />
                في السلة
              </>
            ) : (
              <>
                <Plus className="size-4" />
                أضف للسلة
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-secondary',
      )}
    >
      {label}
    </button>
  )
}
