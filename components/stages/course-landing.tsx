'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  PlayCircle,
  Sparkles,
  Lock,
  Play,
  Layers,
  Check,
  BookOpen,
} from 'lucide-react'
import type { Stage, Branch, MonthlyCourse, Lecture } from '@/lib/landing-data'
import { useCart } from '@/components/cart/cart-provider'

function formatEGP(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value)
}

// Groups the course lectures under their sections, preserving section order and
// appending an "uncategorised" group for lectures without a section.
function groupLecturesBySection(course: MonthlyCourse) {
  const groups: { id: string; title: string; lectures: Lecture[] }[] = []
  const bySection = new Map<string, Lecture[]>()
  const uncategorised: Lecture[] = []

  for (const lecture of course.lectures) {
    if (lecture.sectionId) {
      const list = bySection.get(lecture.sectionId) ?? []
      list.push(lecture)
      bySection.set(lecture.sectionId, list)
    } else {
      uncategorised.push(lecture)
    }
  }

  for (const section of course.sections ?? []) {
    const lectures = bySection.get(section.id) ?? []
    if (lectures.length > 0) groups.push({ id: section.id, title: section.title, lectures })
  }
  if (uncategorised.length > 0) {
    groups.push({ id: '__none__', title: 'محاضرات الكورس', lectures: uncategorised })
  }
  return groups
}

function LectureRow({
  lecture,
  index,
  watchHref,
}: {
  lecture: Lecture
  index: number
  watchHref: string
}) {
  const { add, inCart, setOpen: setCartOpen } = useCart()
  // A lecture is "free to watch" if explicitly flagged OR its price is 0.
  // Don't show "مجانية" badge when the lecture has a price > 0 even if isFree
  // is set, because isFree just means "preview" in that context.
  const freeAccess = !!lecture.isFree
  const free = freeAccess && (lecture.price === 0 || lecture.price == null)
  const lessonsCount = lecture.lessons.length
  const lectureInCart = lecture.dbId ? inCart(lecture.dbId) : false

  // Buys ONLY this lecture (lecture_id), never the whole course bundle.
  async function handleBuyLecture() {
    if (!lecture.dbId) return
    if (!lectureInCart) await add(lecture.dbId, lecture.title)
    setCartOpen(true)
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-navy/10 bg-white p-4 transition-colors hover:bg-cream/60 dark:border-ink-line dark:bg-ink-raised dark:hover:bg-ink-base/60">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-navy/10 bg-cream font-mono text-sm font-bold text-navy dark:border-ink-line dark:bg-ink-base dark:text-ink-fg">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate font-heading text-base font-bold text-navy dark:text-ink-fg">
            {lecture.title}
          </h4>
          {free && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-brand/15 px-2.5 py-0.5 text-xs font-bold text-emerald-deep dark:bg-teal-glow/15 dark:text-teal-glow">
              <Play className="size-3" />
              مجانية
            </span>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-navy-soft dark:text-ink-dim">
          <BookOpen className="size-3.5" />
          {lessonsCount} درس
        </p>
      </div>

      {freeAccess ? (
        <Link
          href={watchHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-deep px-4 py-2.5 text-sm font-bold text-cream transition-colors hover:bg-emerald-brand dark:bg-teal-glow dark:text-ink-base dark:hover:bg-teal-glow/90"
        >
          <Play className="size-4" />
          شاهد الآن
        </Link>
      ) : (
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden flex-col items-end sm:flex">
            {lecture.oldPrice ? (
              <span className="text-xs text-navy-soft/60 line-through dark:text-ink-dim/60">
                {formatEGP(lecture.oldPrice)}
              </span>
            ) : null}
            <span className="font-heading text-base font-extrabold text-navy dark:text-ink-fg">
              {formatEGP(lecture.price)}
              <span className="mr-1 text-xs font-bold text-gold-deep dark:text-teal-glow">ج.م</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleBuyLecture}
            disabled={!lecture.dbId}
            className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2.5 text-sm font-bold text-cream transition-colors hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50 dark:bg-violet-glow dark:text-white dark:hover:bg-violet-deep"
          >
            {lectureInCart ? (
              <>
                <Check className="size-4" />
                أكمل الشراء
              </>
            ) : (
              <>
                <Lock className="size-3.5" />
                اشترِ المحاضرة
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export function CourseLanding({
  stage,
  branch,
  course,
}: {
  stage: Stage
  branch: Branch
  course: MonthlyCourse
}) {
  const { addCourse, courseInCart, setOpen: setCartOpen } = useCart()
  const added = course.dbId ? courseInCart(course.dbId) : false

  const groups = groupLecturesBySection(course)
  const totalLessons = course.lectures.reduce((sum, l) => sum + l.lessons.length, 0)
  const freeCount = course.lectures.filter((l) => l.isFree && (l.price === 0 || l.price == null)).length
  const basePath = `/stages/${stage.id}/${branch.id}/${course.id}`

  async function handleSubscribe() {
    if (!course.dbId) return
    if (!added) await addCourse(course.dbId, course.title)
    setCartOpen(true)
  }

  return (
    <main className="min-h-screen bg-cream dark:bg-ink-base">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy dark:bg-ink-raised">
        <div className="graph-paper-light pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-gold/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-28 md:px-8 md:pb-24 md:pt-32">
          {/* breadcrumb */}
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-cream/60">
            <Link href="/#stages" className="transition-colors hover:text-gold dark:hover:text-teal-glow">
              المراحل
            </Link>
            <ArrowRight className="size-3.5" />
            <Link href={`/stages/${stage.id}`} className="transition-colors hover:text-gold dark:hover:text-teal-glow">
              {stage.title}
            </Link>
            <ArrowRight className="size-3.5" />
            <Link
              href={`/stages/${stage.id}/${branch.id}`}
              className="transition-colors hover:text-gold dark:hover:text-teal-glow"
            >
              {branch.title}
            </Link>
            <ArrowRight className="size-3.5" />
            <span className="text-cream/90">{course.title}</span>
          </nav>

          <div className="mt-8 grid items-center gap-12 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-gold backdrop-blur dark:text-teal-glow">
                <Sparkles className="size-4" />
                محاضرة من {branch.title}
              </span>
              <h1 className="mt-5 text-balance font-heading text-4xl font-extrabold leading-tight text-cream md:text-6xl">
                {course.title}
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-cream/70">
                {course.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-navy-deep/40 px-4 py-2.5 text-sm text-cream/90">
                  <Layers className="size-4 text-gold" />
                  {course.lectures.length} محاضرة
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-navy-deep/40 px-4 py-2.5 text-sm text-cream/90">
                  <PlayCircle className="size-4 text-emerald-brand" />
                  {totalLessons} درس
                </span>
                {freeCount > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-brand/30 bg-emerald-brand/10 px-4 py-2.5 text-sm text-emerald-100">
                    <Play className="size-4 text-emerald-brand" />
                    {freeCount} محاضرة مجانية
                  </span>
                )}
              </div>

              {/* price + subscribe */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <div className="flex items-baseline gap-2">
                  {course.oldPrice && (
                    <span className="text-lg text-cream/40 line-through">
                      {formatEGP(course.oldPrice)}
                    </span>
                  )}
                  <strong className="font-heading text-3xl font-extrabold text-cream">
                    {formatEGP(course.price)}
                  </strong>
                  <span className="text-sm font-bold text-gold dark:text-teal-glow">ج.م</span>
                </div>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-navy transition-colors hover:bg-gold-deep dark:bg-violet-glow dark:text-white dark:hover:bg-violet-deep"
                >
                  {added ? (
                    <>
                      <Check className="size-4" />
                      أكمل الشراء
                    </>
                  ) : (
                    <>
                      اشترك في الكورس
                      <ArrowRight className="size-4 -rotate-180" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-navy-deep/50 lg:aspect-[4/5]">
              <Image
                src={course.image || course.lectures[0]?.image || '/lessons/complex-numbers.png'}
                alt={course.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 420px"
                priority
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/60 to-transparent"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <div className="relative h-12 md:h-16">
          <div className="absolute inset-x-0 bottom-0 h-12 rounded-t-[2.5rem] bg-cream md:h-16 md:rounded-t-[3.5rem] dark:bg-ink-base" />
        </div>
      </section>

      {/* ── Curriculum ───────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-4xl px-5 py-12 md:px-8 md:py-16">
        <div className="flex flex-col items-center text-center">
          <span className="text-sm font-semibold text-gold-deep dark:text-teal-glow">
            <span className="font-mono">{'// '}</span>
            محتوى الكورس
          </span>
          <h2 className="mt-3 text-balance font-heading text-3xl font-extrabold text-navy md:text-4xl dark:text-ink-fg">
            محتوى الكورس
          </h2>
          <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-navy-soft dark:text-ink-dim">
            كل المحاضرات ودروسها بالترتيب. المحاضرات المجانية تقدر تتفرج عليها فورًا، والباقي يتفتح بالاشتراك.
          </p>
        </div>

        {course.lectures.length > 0 ? (
          <div className="mt-12 flex flex-col gap-8">
            {groups.map((group, gi) => {
              // continuous numbering across groups
              const startIndex = groups
                .slice(0, gi)
                .reduce((sum, g) => sum + g.lectures.length, 0)
              return (
                <div key={group.id}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg bg-navy text-sm font-bold text-cream dark:bg-violet-glow dark:text-white">
                      {gi + 1}
                    </span>
                    <h3 className="font-heading text-lg font-bold text-navy dark:text-ink-fg">
                      {group.title}
                    </h3>
                    <span className="text-xs font-semibold text-navy-soft dark:text-ink-dim">
                      ({group.lectures.length} محاضرة)
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {group.lectures.map((lecture, li) => (
                      <LectureRow
                        key={lecture.dbId ?? lecture.id}
                        lecture={lecture}
                        index={startIndex + li}
                        watchHref={`${basePath}/watch/${lecture.id}`}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-dashed border-navy/15 bg-white p-10 text-center text-navy-soft dark:border-ink-line dark:bg-ink-raised dark:text-ink-dim">
            لم تتم إضافة محاضرات لهذا الكورس حتى الآن.
          </div>
        )}

        {/* back to branch */}
        <div className="mt-12 flex justify-center">
          <Link
            href={`/stages/${stage.id}/${branch.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-navy/15 px-6 py-3 text-sm font-bold text-navy transition-colors hover:bg-navy/5 dark:border-ink-line dark:text-ink-fg dark:hover:bg-ink-raised"
          >
            <ArrowRight className="size-4" />
            رجوع لكورسات {branch.title}
          </Link>
        </div>
      </section>
    </main>
  )
}
