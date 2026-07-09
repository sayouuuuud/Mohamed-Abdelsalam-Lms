'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/components/cart/cart-provider'
import type { Stage, Lesson } from '@/lib/landing-data'

function formatEGP(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value)
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
  lessonsCount: number
  lessons: Lesson[]
  stageTitle: string
  branchTitle: string
}

export function StudentBrowsePage({
  stages = [],
  gradeLocked = false,
}: {
  stages?: Stage[]
  gradeLocked?: boolean
}) {
  const searchParams = useSearchParams()
  const { add, inCart, setOpen, count } = useCart()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [details, setDetails] = useState<FlatLecture | null>(null)

  // Flatten the curriculum tree into a searchable list of lectures.
  const lectures = useMemo<FlatLecture[]>(() => {
    const out: FlatLecture[] = []
    for (const stage of stages) {
      for (const branch of stage.branches) {
        for (const lec of branch.lectures) {
          out.push({
            dbId: lec.dbId,
            slug: lec.id,
            image: lec.image,
            title: lec.title,
            description: lec.description,
            price: lec.price,
            oldPrice: lec.oldPrice,
            badge: lec.badge,
            lessonsCount: lec.lessons.length,
            lessons: lec.lessons,
            stageTitle: stage.title,
            branchTitle: branch.title,
          })
        }
      }
    }
    return out
  }, [stages])

  const filtered = useMemo(() => {
    const q = query.trim()
    return lectures.filter((l) => {
      if (stageFilter !== 'all' && l.stageTitle !== stageFilter) return false
      if (!q) return true
      return (
        l.title.includes(q) ||
        l.branchTitle.includes(q) ||
        l.stageTitle.includes(q)
      )
    })
  }, [lectures, query, stageFilter])

  const stageNames = useMemo(() => stages.map((s) => s.title), [stages])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">تصفّح المحاضرات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {gradeLocked
              ? `محاضرات ${stages[0]?.title ?? 'صفّك'} — اختار اللي محتاجه وضيفه للسلة.`
              : 'اختار المحاضرات اللي محتاجها وضيفها للسلة، وابعت طلب الاشتراك للأدمن.'}
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
            placeholder="ابحث عن محاضرة أو فرع..."
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

      {/* Lectures grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <BookOpen className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">مفيش محاضرات مطابقة لبحثك.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lec, i) => {
            const added = lec.dbId ? inCart(lec.dbId) : false
            return (
              <div
                key={(lec.dbId ?? lec.title) + i}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                {/* lecture artwork */}
                <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-br from-secondary to-muted">
                  <Image
                    src={lec.image || `/lessons/${lec.slug}.png`}
                    alt={lec.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                    <span className="rounded-lg bg-card/90 px-2 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur">
                      {lec.stageTitle}
                    </span>
                    {lec.badge && (
                      <span className="rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground shadow">
                        {lec.badge}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                <h3 className="text-base font-bold text-foreground">{lec.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{lec.branchTitle}</p>
                {lec.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {lec.description}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setDetails(lec)}
                  className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg text-xs font-semibold text-primary transition-colors hover:underline"
                >
                  <PlayCircle className="size-3.5" />
                  عرض تفاصيل المحاضرة ({lec.lessonsCount} درس)
                </button>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-extrabold text-foreground">
                      {formatEGP(lec.price)}
                    </span>
                    <span className="text-xs font-bold text-primary">ج.م</span>
                    {lec.oldPrice && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatEGP(lec.oldPrice)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={added || !lec.dbId}
                    onClick={() => lec.dbId && add(lec.dbId, lec.title)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors',
                      added
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-primary text-primary-foreground hover:opacity-90',
                    )}
                  >
                    {added ? (
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
          })}
        </div>
      )}

      {/* Lecture details modal */}
      {details && (
        <LectureDetailsModal
          lecture={details}
          inCart={details.dbId ? inCart(details.dbId) : false}
          onAdd={() => details.dbId && add(details.dbId, details.title)}
          onClose={() => setDetails(null)}
        />
      )}
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
              {lecture.lessons.map((lesson, i) => (
                <li
                  key={lesson.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-lg',
                        lesson.isFree
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {lesson.isFree ? <Play className="size-3.5" /> : <Lock className="size-3.5" />}
                    </span>
                    <div>
                      <span className="block text-sm font-semibold text-foreground">
                        {i + 1}. {lesson.title}
                      </span>
                      {lesson.isFree && (
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
              ))}
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
