/**
 * lib/seo.ts — مساعدات SEO المركزية
 * ====================================
 * مصدر الدومين الوحيد: NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → localhost
 * لا تكتب دومين hardcoded في أي ملف آخر.
 */

// ──────────────────────────────────────────────────────────────────────
// URL helpers
// ──────────────────────────────────────────────────────────────────────

/** جيب الدومين الأساسي للموقع */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  return 'http://localhost:3000'
}

/** حوّل مسار نسبي لـ URL مطلق */
export function absoluteUrl(path: string): string {
  const base = getSiteUrl()
  // تأكد إن المسار يبدأ بـ /
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

// ──────────────────────────────────────────────────────────────────────
// Description builders — وصف فريد لكل نوع صفحة
// ──────────────────────────────────────────────────────────────────────

/**
 * ابنِ وصف SEO لصفحة مرحلة دراسية
 * مثال: "كورسات وشرح رياضيات للصف الثالث الثانوي — 3 فروع دراسية، تغطية شاملة لمنهج رياضيات ثانوي"
 */
export function buildStageDescription(opts: {
  stageTitle: string
  subtitle: string | null | undefined
  branchCount: number
  siteName?: string
}): string {
  const { stageTitle, subtitle, branchCount, siteName = 'المنصة' } = opts
  if (subtitle && subtitle.length > 20) {
    return subtitle.slice(0, 155)
  }
  return `كورسات وشرح رياضيات ${stageTitle} على ${siteName} — ${branchCount} فرع دراسي، تغطية شاملة للمنهج`
}

/**
 * ابنِ وصف SEO لصفحة فرع دراسي
 */
export function buildBranchDescription(opts: {
  branchTitle: string
  stageTitle: string
  description: string | null | undefined
  lectureCount: number
  siteName: string
}): string {
  const { branchTitle, stageTitle, description, lectureCount, siteName } = opts
  if (description && description.length > 20) {
    return description.slice(0, 155)
  }
  return `${branchTitle} — ${stageTitle} على ${siteName}، ${lectureCount} محاضرة شرح ومتابعة`
}

/**
 * ابنِ وصف SEO لصفحة كورس/محاضرة
 */
export function buildCourseDescription(opts: {
  courseTitle: string
  branchTitle: string
  stageTitle: string
  description: string | null | undefined
  price: number
  siteName: string
}): string {
  const { courseTitle, branchTitle, stageTitle, description, price, siteName } = opts
  if (description && description.length > 20) {
    return description.slice(0, 155)
  }
  const priceText = price === 0 ? 'مجاناً' : `بـ ${price} جنيه`
  return `${courseTitle} — ${branchTitle} ${stageTitle} على ${siteName}. اشترك ${priceText} وابدأ المذاكرة دلوقتي`
}

// ──────────────────────────────────────────────────────────────────────
// noindex helper
// ──────────────────────────────────────────────────────────────────────

/** metadata ثابتة للصفحات الخاصة (أدمن / طالب / auth / watch) */
export const NOINDEX_METADATA = {
  robots: { index: false, follow: false },
} as const
