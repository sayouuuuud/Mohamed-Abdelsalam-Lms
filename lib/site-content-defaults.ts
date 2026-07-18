// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SAFE module: types + defaults + deepMerge only.
// NO server imports here (no supabase, no next/headers) — client components
// import DEFAULT_SITE_CONTENT and types from this file.
// The server-only getSiteContent() lives in lib/site-content.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type HeroContent = {
  badge: string
  titleLine1: string
  titleLine2: string
  titleHighlight: string
  description: string
  cta1Text: string
  cta1Href: string
  cta2Text: string
  cta2Href: string
  trustPoints: string[]
  teacherImageLight: string
  teacherImageDark: string
  teacherImageAlt: string
  pillLabels: string[]
  miniStats: { value: number; prefix: string; suffix: string; label: string }[]
}

export type FeatureItem = {
  step: string
  title: string
  description: string
  icon: string
}

export type FeaturesContent = {
  badge: string
  title: string
  description: string
  items: FeatureItem[]
}

export type StatItem = {
  value: number
  suffix: string
  label: string
}

export type StatsContent = {
  badge: string
  title: string
  description: string
  items: StatItem[]
}

export type JourneyPoint = {
  month: string
  score: number
}

export type TestimonialItem = {
  name: string
  grade: string
  subject: string
  quote: string
  before: number
  after: number
  journey: JourneyPoint[]
}

export type TestimonialsContent = {
  badge: string
  title: string
  description: string
  items: TestimonialItem[]
}

export type CtaContent = {
  badge: string
  title: string
  description: string
  cta1Text: string
  cta1Href: string
  cta2Text: string
  cta2Href: string
  perks: string[]
}

export type FooterLink = { label: string; href: string }

export type SocialPlatform = 'website' | 'telegram' | 'whatsapp' | 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'twitter'

export type SocialLink = {
  platform: SocialPlatform
  href: string
  enabled: boolean
}

export type FooterContent = {
  siteName: string
  siteTagline: string
  description: string
  phone: string
  address: string
  quickLinks: FooterLink[]
  copyright: string // supports {year} token
  socialLinks: SocialLink[]
}

export type NavbarContent = {
  siteName: string
  logoUrl: string
  links: FooterLink[]
  ctaLoginText: string
  ctaRegisterText: string
  ctaAccountText: string
}

export type SeoContent = {
  title: string
  description: string
  loaderText: string
  loaderEquation: string
  /** كلمات مفتاحية مفصولة بفاصلة — تُستخدم في وصف الصفحات */
  keywords: string
  /** كود التحقق من Google Search Console */
  googleVerification: string
}

export type LoginPanelStat = {
  value: string
  label: string
}

export type LoginPanelContent = {
  badge: string
  headline: string
  perks: string[]
  stats: LoginPanelStat[]
  brandName: string   // displayed name in the auth panel header
  logoUrl: string     // optional uploaded logo image URL
}

export type StageOfferContent = {
  badgeText: string
  headingTemplate: string   // {stageName} will be replaced at runtime
  description: string
  featureItems: string[]    // 4 bullet points
  priceLabel: string
  buttonText: string
  guaranteeText: string
}

export type SiteContent = {
  hero: HeroContent
  features: FeaturesContent
  stats: StatsContent
  testimonials: TestimonialsContent
  cta: CtaContent
  footer: FooterContent
  navbar: NavbarContent
  seo: SeoContent
  login_panel: LoginPanelContent
  stage_offer: StageOfferContent
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults — exact copies of every hardcoded value in the components right now.
// DB empty = site looks identical to before.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero: {
    badge: 'منصة الرياضيات الأولى للثانوية العامة',
    titleLine1: 'الرياضيات مش صعبة،',
    titleLine2: 'هي بس محتاجة {highlight} صح',
    titleHighlight: 'مُعلّم',
    description:
      'مع الأستاذ عبد السلام هتفهم كل فكرة من جذورها، وتتدرّب لحد ما المسألة تبقى أسهل حاجة. اختار مرحلتك وابدأ رحلتك للتفوق.',
    cta1Text: 'اختار مرحلتك الدراسية',
    cta1Href: '#stages',
    cta2Text: 'اعرف أكتر عن المنصة',
    cta2Href: '#features',
    trustPoints: ['أول حصة مجانًا', 'إلغاء في أي وقت', 'متابعة مع ولي الأمر'],
    teacherImageLight: '/teacher-abdelsalam.webp',
    teacherImageDark: '/teacher-abdelsalam-dark.webp',
    teacherImageAlt: 'الأستاذ عبد السلام، مدرس الرياضيات',
    pillLabels: ['تكامل', 'تفاضل', 'جبر', 'إحصاء'],
    miniStats: [
      { value: 25, prefix: '+', suffix: '', label: 'سنة خبرة' },
      { value: 48, prefix: '+', suffix: ' ألف', label: 'طالب' },
      { value: 98, prefix: '٪', suffix: '', label: 'نسبة رضا' },
    ],
  },

  features: {
    badge: 'إزاي بنذاكر مع بعض',
    title: 'نظام تعليمي متكامل، مبني على خطوات واضحة.',
    description:
      'مش مجرد فيديوهات؛ ده مسار متدرّج يمسكك من أول فكرة لحد ما تدخل الامتحان واثق من نفسك.',
    items: [
      {
        step: '٠١',
        title: 'شرح مبسّط ومتدرّج',
        description:
          'كل فكرة بتتشرح من الصفر بأسلوب سهل يوصّل المعلومة لأي طالب مهما كان مستواه.',
        icon: 'lightbulb',
      },
      {
        step: '٠٢',
        title: 'فيديوهات عالية الجودة',
        description:
          'حصص مسجّلة بجودة عالية تقدر تتفرج عليها وتعيدها في أي وقت ومن أي مكان.',
        icon: 'video',
      },
      {
        step: '٠٣',
        title: 'بنك أسئلة وامتحانات',
        description:
          'آلاف المسائل والامتحانات التفاعلية مع تصحيح فوري يثبّت المعلومة بعد كل درس.',
        icon: 'clipboard',
      },
      {
        step: '٠٤',
        title: 'متابعة وتقارير',
        description:
          'تقارير دورية للطالب وولي الأمر توضّح التقدّم ونقاط القوة والضعف أول بأول.',
        icon: 'chart',
      },
    ],
  },

  stats: {
    badge: 'أرقامنا',
    title: 'نتائج بتتكلم عن نفسها',
    description:
      'سنين من الخبرة وآلاف الطلاب اللي وصلوا لأعلى الدرجات مع مستر عبد السلام.',
    items: [
      { value: 25, suffix: '+', label: 'سنة خبرة في تدريس الرياضيات' },
      { value: 48000, suffix: '+', label: 'طالب وطالبة على المنصة' },
      { value: 1200, suffix: '+', label: 'فيديو ودرس تعليمي' },
      { value: 98, suffix: '%', label: 'نسبة رضا الطلاب' },
    ],
  },

  testimonials: {
    badge: 'قصص نجاح حقيقية',
    title: 'كل طالب رحلة... وكل رحلة منحنى صاعد',
    description:
      'مش مجرد كلام. دي درجات طلاب حقيقيين اتحسّنت شهر ورا شهر لحد الامتحان النهائي.',
    items: [
      {
        name: 'مريم أحمد',
        grade: 'الثالث الثانوي',
        subject: 'الرياضيات البحتة',
        quote:
          'مستر عبد السلام غيّر علاقتي بالرياضيات تمامًا، بقيت بفهم المسألة قبل ما أحلّها. جبت أعلى درجة في حياتي!',
        before: 42,
        after: 98,
        journey: [
          { month: 'سبتمبر', score: 42 },
          { month: 'أكتوبر', score: 51 },
          { month: 'نوفمبر', score: 60 },
          { month: 'ديسمبر', score: 68 },
          { month: 'يناير', score: 79 },
          { month: 'فبراير', score: 88 },
          { month: 'مارس', score: 93 },
          { month: 'الامتحان', score: 98 },
        ],
      },
      {
        name: 'يوسف خالد',
        grade: 'الثاني الثانوي',
        subject: 'التفاضل والتكامل',
        quote:
          'طريقة الشرح بسيطة جدًا والامتحانات بعد كل درس بتثبّت المعلومة. التفاضل بقى أسهل حاجة عندي.',
        before: 55,
        after: 95,
        journey: [
          { month: 'سبتمبر', score: 55 },
          { month: 'أكتوبر', score: 58 },
          { month: 'نوفمبر', score: 66 },
          { month: 'ديسمبر', score: 72 },
          { month: 'يناير', score: 81 },
          { month: 'فبراير', score: 87 },
          { month: 'مارس', score: 91 },
          { month: 'الامتحان', score: 95 },
        ],
      },
      {
        name: 'حبيبة محمود',
        grade: 'الأول الثانوي',
        subject: 'الجبر والهندسة',
        quote:
          'المنصة منظمة وكل المواد مرتبة، بحس إن فيه حد ماسكني خطوة بخطوة لحد الامتحان.',
        before: 48,
        after: 96,
        journey: [
          { month: 'سبتمبر', score: 48 },
          { month: 'أكتوبر', score: 54 },
          { month: 'نوفمبر', score: 63 },
          { month: 'ديسمبر', score: 71 },
          { month: 'يناير', score: 80 },
          { month: 'فبراير', score: 86 },
          { month: 'مارس', score: 92 },
          { month: 'الامتحان', score: 96 },
        ],
      },
    ],
  },

  cta: {
    badge: 'ابدأ النهاردة',
    title: 'جاهز تبدأ رحلة التفوق في الرياضيات؟',
    description:
      'انضم لآلاف الطلاب اللي حقّقوا أعلى الدرجات مع مستر عبد السلام. سجّل دلوقتي وابدأ أول حصة مجانًا.',
    cta1Text: 'سجّل الآن مجانًا',
    cta1Href: '/student',
    cta2Text: 'تصفّح المراحل',
    cta2Href: '#stages',
    perks: ['أول حصة مجانًا', 'إلغاء في أي وقت', 'متابعة مع ولي الأمر'],
  },

  footer: {
    siteName: 'عبد السلام',
    siteTagline: 'أستاذ الرياضيات',
    description:
      'منصة تعليمية متخصصة في الرياضيات لجميع المراحل الدراسية، بأسلوب شرح مبسّط ومتابعة مستمرة لضمان تفوّق كل طالب.',
    phone: '+20 100 000 0000',
    address: 'القاهرة، جمهورية مصر العربية',
    quickLinks: [
      { label: 'الرئيسية', href: '#hero' },
      { label: 'مميزاتنا', href: '#features' },
      { label: 'المراحل الدراسية', href: '#stages' },
      { label: 'تسجيل الدخول', href: '/student' },
    ],
    copyright: '© {year} منصة الأستاذ عبد السلام للرياضيات — جميع الحقوق محفوظة.',
  socialLinks: [
    { platform: 'website' as SocialPlatform,   href: '#', enabled: true },
    { platform: 'telegram' as SocialPlatform,  href: '#', enabled: true },
    { platform: 'whatsapp' as SocialPlatform,  href: '#', enabled: true },
    { platform: 'youtube' as SocialPlatform,   href: '#', enabled: false },
    { platform: 'facebook' as SocialPlatform,  href: '#', enabled: false },
    { platform: 'instagram' as SocialPlatform, href: '#', enabled: false },
    { platform: 'tiktok' as SocialPlatform,    href: '#', enabled: false },
    { platform: 'twitter' as SocialPlatform,   href: '#', enabled: false },
  ],
  },

  navbar: {
    siteName: 'عبد السلام',
    logoUrl: '',
    links: [
      { label: 'المنهج', href: '#features' },
      { label: 'المراحل', href: '#stages' },
      { label: 'أرقامنا', href: '#stats' },
      { label: 'آراء الطلاب', href: '#testimonials' },
    ],
    ctaLoginText: 'تسجيل الدخول',
    ctaRegisterText: 'ابدأ الآن',
    ctaAccountText: 'حسابي',
  },

  seo: {
    title: 'الأستاذ عبد السلام | منصة الرياضيات للثانوية العامة',
    description:
      'منصة تعليمية متكاملة لشرح مادة الرياضيات للمرحلة الثانوية. ابدأ الآن واضمن تفوقك.',
    loaderText: 'جاري تجهيز المنصة...',
    loaderEquation: 'f(x) = ∫ e^x dx',
    keywords: 'رياضيات ثانوي, شرح رياضيات, أولى ثانوي, تانية ثانوي, تالتة ثانوي, كورسات رياضيات',
    googleVerification: '',
  },

  stage_offer: {
    badgeText: 'العرض الأوفر',
    headingTemplate: 'اشترك في {stageName} كاملة',
    description:
      'فروع كاملة بكل الكورسات والدروس والامتحانات والمتابعة — في باقة واحدة بسعر أوفر بكتير من الاشتراك المنفصل.',
    featureItems: [
      'محاضرة فيديو بجودة عالية',
      'وصول مدى الترم بدون حدود',
      'امتحانات وواجبات بعد كل محاضرة',
      'متابعة وتقارير لمستواك',
    ],
    priceLabel: 'سعر الترم كامل',
    buttonText: 'اشترك في المرحلة كاملة',
    guaranteeText: 'ضمان استرجاع خلال 7 أيام',
  },

  login_panel: {
    badge: 'منصة الرياضيات الأولى للثانوية العامة',
    headline: 'الرياضيات مش صعبة، هي بس محتاجة مُعلّم صح.',
    perks: [
      'شرح مبسّط لكل درس خطوة بخطوة',
      'امتحانات بعد كل درس تثبّت المعلومة',
      'متابعة مستمرة لمستواك ودرجاتك',
    ],
    stats: [
      { value: '+48k', label: 'طالب وطالبة' },
      { value: '98%', label: 'نسبة رضا' },
      { value: '+25', label: 'سنة خبرة' },
    ],
    brandName: 'عبد السلام',
    logoUrl: '',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep merge — source overrides target at every key.
// Arrays replace entirely (not concat). Missing keys fall back to default.
// ─────────────────────────────────────────────────────────────────────────────

export function deepMerge<T>(target: T, source: Partial<T>): T {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return (source ?? target) as T
  }
  const result = { ...target } as Record<string, unknown>
  for (const key of Object.keys(source)) {
    const srcVal = (source as Record<string, unknown>)[key]
    const tgtVal = (target as Record<string, unknown>)[key]
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal) &&
      tgtVal !== null
    ) {
      result[key] = deepMerge(tgtVal, srcVal as Partial<typeof tgtVal>)
    } else if (srcVal !== undefined) {
      result[key] = srcVal
    }
  }
  return result as T
}
