import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_SITE_CONTENT,
  deepMerge,
  type SiteContent,
  type HeroContent,
  type FeaturesContent,
  type StatsContent,
  type TestimonialsContent,
  type CtaContent,
  type FooterContent,
  type NavbarContent,
  type SeoContent,
  type LoginPanelContent,
} from '@/lib/site-content-defaults'

// Re-export for server-side consumers (app/page.tsx, app/layout.tsx, actions).
// Client components MUST import from '@/lib/site-content-defaults' instead.
export { DEFAULT_SITE_CONTENT }
export type {
  SiteContent,
  HeroContent,
  FeaturesContent,
  StatsContent,
  TestimonialsContent,
  CtaContent,
  FooterContent,
  NavbarContent,
  SeoContent,
  LoginPanelContent,
  LoginPanelStat,
  FeatureItem,
  StatItem,
  TestimonialItem,
  JourneyPoint,
  FooterLink,
} from '@/lib/site-content-defaults'

// ─────────────────────────────────────────────────────────────────────────────
// getSiteContent — single server-side DB read, deep merged with defaults.
// NEVER returns undefined for any field. Safe to call with an empty DB.
// ─────────────────────────────────────────────────────────────────────────────

export async function getSiteContent(): Promise<SiteContent> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('site_content')
      .select('section, value')

    if (error) {
      console.log('[v0] getSiteContent fetch error:', error.message)
      return DEFAULT_SITE_CONTENT
    }

    if (!data || data.length === 0) return DEFAULT_SITE_CONTENT

    const dbMap: Record<string, unknown> = {}
    for (const row of data) {
      dbMap[row.section] = row.value
    }

    return {
      hero:         deepMerge(DEFAULT_SITE_CONTENT.hero,         (dbMap.hero         ?? {}) as Partial<HeroContent>),
      features:     deepMerge(DEFAULT_SITE_CONTENT.features,     (dbMap.features     ?? {}) as Partial<FeaturesContent>),
      stats:        deepMerge(DEFAULT_SITE_CONTENT.stats,        (dbMap.stats        ?? {}) as Partial<StatsContent>),
      testimonials: deepMerge(DEFAULT_SITE_CONTENT.testimonials, (dbMap.testimonials ?? {}) as Partial<TestimonialsContent>),
      cta:          deepMerge(DEFAULT_SITE_CONTENT.cta,          (dbMap.cta          ?? {}) as Partial<CtaContent>),
      footer:       deepMerge(DEFAULT_SITE_CONTENT.footer,       (dbMap.footer       ?? {}) as Partial<FooterContent>),
      navbar:       deepMerge(DEFAULT_SITE_CONTENT.navbar,       (dbMap.navbar       ?? {}) as Partial<NavbarContent>),
      seo:          deepMerge(DEFAULT_SITE_CONTENT.seo,          (dbMap.seo          ?? {}) as Partial<SeoContent>),
      login_panel:  deepMerge(DEFAULT_SITE_CONTENT.login_panel,  (dbMap.login_panel  ?? {}) as Partial<LoginPanelContent>),
    }
  } catch (err) {
    // Re-throw Next.js control-flow signals (e.g. DYNAMIC_SERVER_USAGE raised by
    // cookies() during static generation). Swallowing them logs false errors and
    // prevents Next from correctly switching the route to dynamic rendering.
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      typeof (err as { digest?: unknown }).digest === 'string' &&
      ((err as { digest: string }).digest === 'DYNAMIC_SERVER_USAGE' ||
        (err as { digest: string }).digest.startsWith('NEXT_'))
    ) {
      throw err
    }
    console.log('[v0] getSiteContent unexpected error:', err)
    return DEFAULT_SITE_CONTENT
  }
}
