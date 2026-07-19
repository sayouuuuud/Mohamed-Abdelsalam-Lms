'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import Image from 'next/image'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { type Stage } from '@/lib/landing-data'
import { cn } from '@/lib/utils'
import { useReveal } from '@/lib/use-reveal'

export function StagesSection({ stages = [] }: { stages?: Stage[] }) {
  const headRef = useReveal<HTMLDivElement>(undefined, { y: 30 })
  const [active, setActive] = useState(0)

  return (
    <section id="stages" className="relative overflow-hidden bg-navy py-20 md:py-28 dark:bg-transparent">

      <div className="relative mx-auto max-w-7xl px-5 md:px-8">

        {/* Desktop: heading + list on the right, card sticky on the left */}
        <div className="hidden items-start gap-10 lg:grid lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div ref={headRef}>
              <span className="text-sm font-semibold text-gold dark:text-teal-glow">
                <span className="font-mono">{'// '}</span>
                اختار مرحلتك
              </span>
              <h2 className="font-thmanyah font-bold mt-3 text-balance text-3xl leading-tight text-cream sm:text-4xl lg:text-5xl">
                مرحلتك التعليمية
              </h2>
              <p className="mt-5 text-pretty text-lg leading-relaxed text-cream/65">
                كل مرحلة فيها المواد مرتبة خطوة بخطوة. عدّي على السنة اللي انت فيها وشوف
                اللي مستنيك جواها.
              </p>
            </div>
            <ul className="mt-14 border-t border-white/10">
            {stages.map((stage, i) => (
              <li key={stage.id}>
                <Link
                  href={`/stages/${stage.id}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className="group grid grid-cols-[5rem_1fr_auto] items-center gap-4 border-b border-white/10 py-8 transition-colors"
                >
                  <span
                    className={cn(
                      'font-thmanyah text-4xl font-bold transition-colors xl:text-6xl',
                      active === i ? 'text-gold dark:text-teal-glow' : 'text-white/15',
                    )}
                  >
                    {stage.index}
                  </span>
                  <span>
                    <span
                      className={cn(
                        'block text-2xl font-bold font-thmanyah transition-colors xl:text-3xl',
                        active === i ? 'text-cream' : 'text-cream/70',
                      )}
                    >
                      {stage.title}
                    </span>
                    <span className="mt-1 block text-sm text-cream/45">{stage.subtitle}</span>
                  </span>
                  <ArrowLeft
                    className={cn(
                      'size-7 transition-all',
                      active === i
                        ? '-translate-x-1 text-gold dark:text-teal-glow'
                        : 'text-white/25 group-hover:text-white/50',
                    )}
                  />
                </Link>
              </li>
            ))}
          </ul>
          </div>

          {stages[active] && <StagePreview stage={stages[active]} />}
        </div>

        {/* Mobile heading — only shows below lg */}
        <div className="lg:hidden">
          <span className="text-sm font-semibold text-gold dark:text-teal-glow">
            <span className="font-mono">{'// '}</span>
            اختار مرحلتك
          </span>
          <h2 className="font-thmanyah font-bold mt-3 text-balance text-3xl leading-tight text-cream sm:text-4xl">
            إيه اللي بيخلي المنصة مختلفة؟
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-cream/65">
            كل مرحلة فيها المواد مرتبة خطوة بخطوة. عدّي على السنة اللي انت فيها وشوف
            اللي مستنيك جواها.
          </p>
        </div>

        {/* Mobile: accordion */}
        <div className="mt-12 border-t border-white/10 lg:hidden">
          {stages.map((stage, i) => (
            <MobileStage
              key={stage.id}
              stage={stage}
              open={active === i}
              onToggle={() => setActive(active === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function StagePreview({ stage }: { stage: Stage }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(
      el,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' },
    )
  }, [stage.id])

  return (
    <div className="relative">
      <div className="sticky top-24">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm"
        >
          {/* stage image — rectangular (16/9), rounded to match card corners */}
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl">
            <Image
              src={stage.image}
              alt={stage.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 420px"
            />
          </div>

          <h3 className="relative mt-5 text-2xl font-extrabold text-cream">
            {stage.title}
          </h3>
          <p className="relative mt-2 leading-relaxed text-cream/65">{stage.subtitle}</p>

          <div className="relative mt-7">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-cream/40">
              الصفوف داخل المرحلة
            </span>
            <ul className="mt-3 space-y-2">
              {stage.branches.map((branch, idx) => (
                <li
                  key={branch.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-navy-deep/40 px-4 py-3 text-cream/90"
                >
                  <span className="font-thmanyah text-sm text-gold dark:text-teal-glow">
                    {(idx + 1).toLocaleString('ar-EG', { minimumIntegerDigits: 2 })}
                  </span>
                  {branch.title}
                </li>
              ))}
            </ul>
          </div>

          <Link
            href={`/stages/${stage.id}`}
            className="relative mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-7 py-4 text-base font-bold text-navy-deep transition-transform duration-200 hover:-translate-y-0.5 dark:bg-violet-glow dark:text-white dark:shadow-[0_0_24px_oklch(0.66_0.2_292_/_0.4)]"
          >
            ادخل المرحلة
            <ArrowLeft className="size-5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function MobileStage({
  stage,
  open,
  onToggle,
}: {
  stage: Stage
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 py-5 text-right"
        aria-expanded={open}
      >
        <span
          className={cn(
            'font-thmanyah text-3xl font-bold transition-colors',
            open ? 'text-gold dark:text-teal-glow' : 'text-white/20',
          )}
        >
          {stage.index}
        </span>
        <span className="flex-1">
          <span className="block text-lg font-extrabold text-cream">{stage.title}</span>
          <span className="mt-0.5 block text-xs text-cream/45">{stage.subtitle}</span>
        </span>
        <ChevronDown
          className={cn(
            'size-5 text-cream/50 transition-transform duration-300',
            open && 'rotate-180',
          )}
        />
      </button>

      <div
        className={cn(
          'grid transition-all duration-300',
          open ? 'grid-rows-[1fr] pb-6' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="text-pretty leading-relaxed text-cream/65">{stage.subtitle}</p>
          <ul className="mt-4 space-y-2">
            {stage.branches.map((branch, idx) => (
              <li
                key={branch.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-navy-deep/40 px-4 py-3 text-sm text-cream/90"
              >
                <span className="font-thmanyah text-gold dark:text-teal-glow">
                  {(idx + 1).toLocaleString('ar-EG', { minimumIntegerDigits: 2 })}
                </span>
                {branch.title}
              </li>
            ))}
          </ul>
          <Link
            href={`/stages/${stage.id}`}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 text-base font-bold text-navy-deep dark:bg-violet-glow dark:text-white"
          >
            ادخل المرحلة
            <ArrowLeft className="size-5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
