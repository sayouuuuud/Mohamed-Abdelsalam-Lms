'use client'

import { Lightbulb, ClipboardCheck, Video, LineChart, BookOpen } from 'lucide-react'
import { useReveal } from '@/lib/use-reveal'
import type { FeaturesContent } from '@/lib/site-content-defaults'
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content-defaults'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  lightbulb: Lightbulb,
  clipboard: ClipboardCheck,
  video: Video,
  chart: LineChart,
  book: BookOpen,
}

const FallbackIcon = BookOpen

export function FeaturesSection({ content = DEFAULT_SITE_CONTENT.features }: { content?: FeaturesContent }) {
  const headRef = useReveal<HTMLDivElement>(undefined, { y: 30 })
  const listRef = useReveal<HTMLDivElement>('.feature-row', { y: 40, duration: 0.6 })

  return (
    <section id="features" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div ref={headRef} className="max-w-2xl">
          <span className="text-sm font-semibold text-emerald-deep dark:text-teal-glow">
            <span className="font-mono">{'// '}</span>
            {content.badge}
          </span>
          <h2 className="font-thmanyah font-bold mt-3 text-balance text-3xl leading-tight text-navy sm:text-4xl lg:text-5xl dark:text-ink-fg">
            {content.title}
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-ink-muted dark:text-ink-dim">
            {content.description}
          </p>
        </div>

        <div ref={listRef} className="mt-14 border-t border-navy/10 dark:border-white/10">
          {content.items.map((f) => {
            const Icon = iconMap[f.icon] ?? FallbackIcon
            return (
              <div
                key={f.step}
                className="feature-row group grid grid-cols-[auto_1fr] items-start gap-5 border-b border-navy/10 py-8 transition-colors hover:bg-cream-deep/40 md:grid-cols-[6rem_3rem_1fr] md:items-center md:gap-8 md:px-4 dark:border-white/10 dark:hover:bg-white/5"
              >
                <span className="font-thmanyah text-3xl font-bold text-navy/15 transition-colors group-hover:text-gold md:text-5xl dark:text-white/15 dark:group-hover:text-teal-glow">
                  {f.step}
                </span>

                <span className="row-start-1 grid size-12 place-items-center rounded-xl bg-navy text-cream transition-transform duration-300 group-hover:-translate-y-1 md:row-auto dark:bg-teal-glow dark:text-ink-base dark:shadow-[0_0_18px_oklch(0.84_0.13_184_/_0.4)]">
                  <Icon className="size-6" />
                </span>

                <div className="col-span-2 md:col-span-1">
                  <h3 className="text-xl font-bold text-navy md:text-2xl dark:text-ink-fg">{f.title}</h3>
                  <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-ink-muted dark:text-ink-dim">
                    {f.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
