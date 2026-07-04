'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, Quote, TrendingUp } from 'lucide-react'
import type { TestimonialsContent, TestimonialItem } from '@/lib/site-content-defaults'
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content-defaults'

type Testimonial = TestimonialItem
import { useReveal } from '@/lib/use-reveal'
import { cn } from '@/lib/utils'

/* Shared section heading. */
function Heading({ content }: { content: Pick<TestimonialsContent, 'badge' | 'title' | 'description'> }) {
  return (
    <div className="reveal-item mx-auto mb-6 max-w-4xl text-center md:mb-10">
      <span className="text-sm font-semibold text-emerald-deep dark:text-teal-glow">
        <span className="font-mono">{'// '}</span>
        {content.badge}
      </span>
      <h2 className="font-thmanyah font-bold mt-3 text-3xl leading-tight text-navy sm:text-4xl lg:text-5xl dark:text-ink-fg">
        {content.title}
      </h2>
      <p className="mt-4 text-pretty text-lg leading-relaxed text-ink-muted dark:text-ink-dim">
        {content.description}
      </p>
    </div>
  )
}

/* One testimonial: progress curve + before/after + quote. */
function TestimonialCard({
  student,
  active = true,
  chartHeightClass = 'h-56 sm:h-64',
  compact = false,
}: {
  student: Testimonial
  active?: boolean
  chartHeightClass?: string
  compact?: boolean
}) {
  const jump = student.after - student.before

  return (
    <div className="grid h-full grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-navy/15 bg-navy/15 shadow-2xl shadow-navy/10 lg:grid-cols-5 dark:border-white/10 dark:bg-white/5 dark:shadow-black/40">
      {/* chart card (navy) */}
      <div
        className={cn(
          'relative bg-navy lg:col-span-3 dark:bg-ink-raised',
          compact ? 'p-4' : 'p-5 sm:p-6 lg:p-7',
        )}
      >
        <div className={cn('flex flex-wrap items-end justify-between gap-4', compact ? 'mb-3' : 'mb-5')}>
          <div>
            <p className="text-xs font-semibold tracking-wider text-gold dark:text-teal-glow">
              منحنى التقدّم
            </p>
            <p className="mt-1 text-lg font-bold text-cream dark:text-ink-fg">{student.subject}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-brand/15 px-3 py-1.5 text-emerald-300 dark:bg-teal-glow/15 dark:text-teal-glow">
            <TrendingUp className="size-4" />
            <span className="text-sm font-bold">
              <span className="font-thmanyah text-xl font-bold">
                +{jump.toLocaleString('ar-EG')}
              </span>{' '}
              نقطة
            </span>
          </div>
        </div>

        <div className={cn('w-full min-w-0', chartHeightClass)} dir="ltr">
          <ResponsiveContainer width="99%" height="100%">
            <ComposedChart
              key={active ? 'on' : 'off'}
              data={student.journey}
              margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
            >
              <defs>
                <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4af37" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.10)" vertical />
              <XAxis
                dataKey="month"
                tick={{ fill: 'rgba(245,241,232,0.55)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: 'rgba(245,241,232,0.45)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <ReferenceLine
                y={50}
                stroke="rgba(255,255,255,0.25)"
                strokeDasharray="5 5"
                label={{
                  value: 'حد النجاح',
                  position: 'insideTopLeft',
                  fill: 'rgba(245,241,232,0.5)',
                  fontSize: 10,
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="none"
                fill="url(#scoreFill)"
                isAnimationActive
                animationDuration={1400}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#d4af37"
                strokeWidth={3}
                dot={{ r: 3, fill: '#0a1f44', stroke: '#d4af37', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#d4af37' }}
                isAnimationActive
                animationDuration={1600}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* before -> after result, written like a math statement */}
        <div
          className={cn(
            'flex items-center justify-center gap-4 font-thmanyah',
            compact ? 'mt-4' : 'mt-6',
          )}
        >
          <div className="text-center">
            <span className="block text-xs text-cream/50 dark:text-ink-dim">قبل</span>
            <span className={cn('font-bold text-red-400 dark:text-red-400/90', compact ? 'text-xl' : 'text-2xl')}>
              {student.before.toLocaleString('ar-EG')}٪
            </span>
          </div>
          <ArrowRight className="size-4 text-cream/30 dark:text-ink-dim" />
          <div className="text-center">
            <span className="block text-xs text-cream/50 dark:text-ink-dim">بعد</span>
            <span className={cn('font-extrabold text-emerald-300 dark:text-teal-glow', compact ? 'text-2xl' : 'text-3xl')}>
              {student.after.toLocaleString('ar-EG')}٪
            </span>
          </div>
        </div>
      </div>

      {/* story card (cream) */}
      <div
        className={cn(
          'flex flex-col bg-cream lg:col-span-2 dark:bg-ink-base',
          compact ? 'p-4' : 'p-5 sm:p-6 lg:p-7',
        )}
      >
        <Quote className={cn('text-gold dark:text-teal-glow/40', compact ? 'size-7' : 'size-9')} />
        <blockquote
          className={cn(
            'flex-1 text-pretty font-medium leading-relaxed text-navy dark:text-ink-fg',
            compact
              ? 'mt-2 line-clamp-3 text-sm leading-snug'
              : 'mt-4 text-lg sm:text-xl',
          )}
        >
          {student.quote}
        </blockquote>

        <div
          className={cn(
            'border-t border-navy/10 dark:border-white/10',
            compact ? 'mt-4 pt-4' : 'mt-6 pt-5',
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'grid place-items-center rounded-full bg-navy font-bold text-cream dark:bg-teal-glow dark:text-ink-base',
                compact ? 'size-10' : 'size-12',
              )}
            >
              {student.name.charAt(0)}
            </span>
            <div>
              <p className="font-bold text-navy dark:text-ink-fg">{student.name}</p>
              <p className="text-sm text-ink-muted dark:text-ink-dim">{student.grade}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Mobile: a real swipeable carousel (one card at a time) using CSS scroll-snap. */
function MobileCarousel({ items }: { items: Testimonial[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const onScroll = () => {
    const el = trackRef.current
    if (!el) return
    // abs handles both LTR and RTL scroll directions across browsers
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth)
    setIndex(Math.min(items.length - 1, Math.max(0, i)))
  }

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    const child = el.children[i] as HTMLElement | undefined
    child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  return (
    <div className="reveal-item">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((s, i) => (
          <div key={i} className="w-full shrink-0 snap-center">
            <TestimonialCard student={s} chartHeightClass="h-32" compact />
          </div>
        ))}
      </div>

      {/* dots */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`اذهب إلى التقييم ${i + 1}`}
            aria-current={i === index}
            className={cn(
              'h-2 rounded-full transition-all',
              i === index
                ? 'w-6 bg-gold dark:bg-teal-glow'
                : 'w-2 bg-navy/20 dark:bg-white/20',
            )}
          />
        ))}
      </div>
    </div>
  )
}

/* Desktop: keep the scroll-driven sticky panel that swaps testimonials. */
function DesktopScrollShowcase({
  items,
  content,
}: {
  items: Testimonial[]
  content: Pick<TestimonialsContent, 'badge' | 'title' | 'description'>
}) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const root = document.getElementById('testimonials-desktop')
    const handleScroll = () => {
      if (!root) return
      const rect = root.getBoundingClientRect()
      const scrollableDistance = rect.height - window.innerHeight
      if (scrollableDistance <= 0) return

      const scrolled = -rect.top
      if (scrolled >= 0 && scrolled <= scrollableDistance) {
        const progress = scrolled / scrollableDistance
        const newIndex = Math.min(
          items.length - 1,
          Math.max(0, Math.floor(progress * items.length)),
        )
        setActive((prev) => (newIndex !== prev ? newIndex : prev))
      } else if (scrolled < 0) {
        setActive((prev) => (prev !== 0 ? 0 : prev))
      } else if (scrolled > scrollableDistance) {
        setActive((prev) =>
          prev !== items.length - 1 ? items.length - 1 : prev,
        )
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [items.length])

  return (
    <div id="testimonials-desktop" className="relative h-[300vh]">
      <div className="sticky top-20 flex min-h-[calc(100vh-5rem)] w-full flex-col justify-center pb-12 pt-4">
        <div className="mx-auto w-full max-w-7xl px-8">
          <Heading content={content} />
          <div className="reveal-item">
            <TestimonialCard student={items[active]} active />
          </div>
        </div>
      </div>
    </div>
  )
}

export function TestimonialsSection({ content = DEFAULT_SITE_CONTENT.testimonials }: { content?: TestimonialsContent }) {
  const root = useReveal<HTMLElement>('.reveal-item')

  return (
    <section ref={root} id="testimonials" className="relative">
      {/* Mobile: swipeable carousel, natural height (no scroll-hijack). */}
      <div className="mx-auto w-full max-w-2xl px-5 py-12 md:hidden">
        <Heading content={content} />
        <MobileCarousel items={content.items} />
      </div>

      {/* Desktop / tablet: original scroll-driven showcase. */}
      <div className="hidden md:block">
        <DesktopScrollShowcase items={content.items} content={content} />
      </div>
    </section>
  )
}
