'use client'

import { AnimatedNumber } from './animated-number'
import type { StatsContent } from '@/lib/site-content-defaults'
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content-defaults'

export function StatsSection({ content = DEFAULT_SITE_CONTENT.stats }: { content?: StatsContent }) {
  return (
    <section id="stats" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-sm font-semibold text-gold-deep dark:text-teal-glow">
            <span className="font-mono">{'// '}</span>
            {content.badge}
          </span>
          <h2 className="font-thmanyah font-bold mt-3 text-balance text-3xl leading-tight text-navy sm:text-4xl lg:text-5xl dark:text-ink-fg">
            {content.title}
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-ink-muted dark:text-ink-dim">
            {content.description}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-navy/10 bg-navy/10 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10 dark:bg-white/10">
          {content.items.map((s) => (
            <div key={s.label} className="bg-cream/80 p-8 backdrop-blur md:p-10 dark:bg-ink-raised/70">
              <div className="flex items-baseline gap-1 text-navy dark:text-ink-fg">
                <span className="stat-num font-thmanyah text-5xl font-bold md:text-4xl lg:text-5xl xl:text-6xl">
                  <AnimatedNumber value={s.value} duration={2.5} />
                </span>
                <span className="font-thmanyah text-3xl font-bold text-gold-deep md:text-2xl lg:text-3xl xl:text-4xl dark:text-teal-glow">
                  {s.suffix === '+' ? '+' : s.suffix === '%' ? '٪' : s.suffix === 'k' ? ' ألف' : s.suffix}
                </span>
              </div>
              <p className="mt-3 text-pretty leading-relaxed text-ink-muted dark:text-ink-dim">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
