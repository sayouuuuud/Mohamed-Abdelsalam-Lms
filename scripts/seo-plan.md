# خطة تطوير الـ SEO الشاملة — منصة LMS

> **الجمهور المستهدف لهذه الوثيقة:** موديل AI (مثل Sonnet) أو مطوّر سينفّذ الخطة مرحلة بمرحلة.
> **اللغة الأساسية للموقع:** العربية (RTL) — `lang="ar" dir="rtl"` في الـ root layout.
> **الفريموورك:** Next.js 16 (App Router) — استخدم Metadata API الرسمية فقط.

---

## القواعد الذهبية (اقرأها قبل أي سطر كود)

1. **نفّذ Milestone واحدة فقط في كل مرة** بالترتيب `M0 → M7`. لا تقفز للأمام.
2. **لا تلمس صفحات الأدمن والطالب إلا لإضافة `noindex`** — هذه صفحات خاصة ولا يجب فهرستها أبداً.
3. **`getSiteContent()` في `lib/site-content.ts` هو مصدر نصوص SEO** (title/description) — لا تكتب نصوصاً hardcoded حيث يمكن القراءة من هناك.
4. **متغير البيئة `NEXT_PUBLIC_SITE_URL`** هو مصدر الدومين الوحيد. لا تكتب دومين hardcoded في أي ملف. إن لم يكن مضبوطاً استخدم fallback: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ثم `http://localhost:3000`.
5. **كل صفحة عامة يجب أن يكون لها canonical URL** — الصفحات العامة هي: `/`, `/stages/[id]`, `/stages/[id]/[branchId]`, `/stages/[id]/[branchId]/[courseId]` فقط.
6. **صفحة `watch/[lectureId]` وصفحة `/auth` لا تُفهرَس** (`noindex`) — المشاهدة تتطلب شراء، والدخول صفحة وظيفية.
7. **لا تكسر أي `generateMetadata` موجود** — الصفحات `app/stages/**` عندها `generateMetadata` فعلاً؛ وسّعها ولا تستبدلها بالكامل إلا حسب تعليمات الـ milestone.
8. **بعد كل milestone:** شغّل `pnpm exec tsc --noEmit` وتأكد من صفر أخطاء، ثم تحقق في المتصفح حسب "معايير القبول".
9. **الكلمات المفتاحية بالعربية** — المنصة تعليمية مصرية (رياضيات/ثانوية عامة). فكّر في مصطلحات البحث الفعلية: "كورسات رياضيات تالتة ثانوي"، "شرح ماث أولى ثانوي"، إلخ.

---

## خريطة الوضع الحالي (مُتحقق منها من الكود الفعلي)

### الموجود حالياً
| العنصر | الحالة | الموقع |
|---|---|---|
| `generateMetadata` في root layout | موجود — يقرأ `seo.title` و `seo.description` من DB | `app/layout.tsx` |
| `generateMetadata` لصفحات المراحل | موجود (أساسي — title/description فقط) | `app/stages/[id]/page.tsx` وباقي صفحات stages |
| `viewport` + `themeColor` | موجود | `app/layout.tsx` |
| `lang="ar" dir="rtl"` | موجود | `app/layout.tsx` |
| Vercel Analytics | موجود (production فقط) | `app/layout.tsx` |
| نصوص SEO قابلة للتحرير من الأدمن | موجودة — `seo` object في `lib/site-content.ts` (جدول `site_content`) | `lib/site-content.ts` + `app/admin/settings` |

### الناقص كلياً (هذا ما ستبنيه)
| العنصر | الأولوية |
|---|---|
| `app/robots.ts` | حرجة |
| `app/sitemap.ts` (ديناميكي من الـ DB) | حرجة |
| `metadataBase` + canonical URLs | حرجة |
| Open Graph + Twitter Cards | عالية |
| صور OG (افتراضية + ديناميكية) | عالية |
| JSON-LD (Organization, WebSite, Course, BreadcrumbList) | عالية |
| `noindex` لصفحات الأدمن/الطالب/auth | حرجة |
| `app/manifest.ts` + أيقونات | متوسطة |
| صفحة 404 مخصصة | متوسطة |
| تحسينات Core Web Vitals | متوسطة |

### الصفحات العامة (القابلة للفهرسة)
```
/                                          → الرئيسية (landing)
/stages/[id]                               → صفحة مرحلة (أولى/تانية/تالتة ثانوي)
/stages/[id]/[branchId]                    → صفحة فرع (علمي/أدبي...)
/stages/[id]/[branchId]/[courseId]         → صفحة كورس/محاضرة
```

### الصفحات الخاصة (noindex إجباري)
```
/auth, /auth/error                          → دخول
/stages/.../watch/[lectureId]               → مشاهدة (تتطلب شراء)
/admin/**                                   → لوحة الأدمن
/student/**                                 → لوحة الطالب
```

### دوال جلب البيانات المتاحة (استخدمها في sitemap والـ metadata)
- `getStageBySlug(id)` — مستخدمة فعلاً في `app/stages/[id]/page.tsx`
- ابحث في `lib/` عن دوال جلب المراحل/الفروع/الكورسات كلها (مثل `getStages`, `getBranches`) — إن لم توجد دالة "جلب الكل" أنشئها في `lib/` بنفس نمط الدوال الموجودة (Supabase server client).

---

## M0 — الأساس: metadataBase + قالب العناوين + متغير البيئة

**الهدف:** كل الـ URLs المطلقة (canonical/OG/sitemap) تُبنى من مصدر واحد، وكل العناوين تتبع قالباً موحداً.

### الملفات
| ملف | عملية |
|---|---|
| `lib/seo.ts` | **جديد** — helpers مركزية |
| `app/layout.tsx` | تعديل `generateMetadata` |

### الخطوات
1. أنشئ `lib/seo.ts` يحتوي:
   ```ts
   export function getSiteUrl(): string {
     return (
       process.env.NEXT_PUBLIC_SITE_URL ||
       (process.env.VERCEL_PROJECT_PRODUCTION_URL
         ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
         : 'http://localhost:3000')
     )
   }
   export function absoluteUrl(path: string): string {
     return new URL(path, getSiteUrl()).toString()
   }
   ```
2. في `app/layout.tsx` وسّع `generateMetadata` ليضيف:
   - `metadataBase: new URL(getSiteUrl())`
   - `title: { default: seo.title, template: `%s | ${seo.title}` }` — لاحظ أن `seo.title` من الـ DB
   - `alternates: { canonical: '/' }`
   - `openGraph: { type: 'website', locale: 'ar_EG', siteName: seo.title }`
   - أبقِ `generator: 'v0.app'` كما هو.

### معايير القبول
- `pnpm exec tsc --noEmit` نظيف.
- `curl -s localhost:3000 | grep -o '<title>[^<]*</title>'` يعرض العنوان من الـ DB.
- عنصر `<link rel="canonical">` موجود في مصدر الصفحة الرئيسية.

### Gotchas
- `title.template` في الـ root layout يُطبَّق على الصفحات الأبناء تلقائياً — أي صفحة ستُصدّر `title: 'اسم الصفحة'` فقط وسيُضاف اسم الموقع تلقائياً. **لا تكرر اسم الموقع يدوياً في عناوين الصفحات.**
- لا تنسَ أن `generateMetadata` في layout هو `async` ويقرأ من DB — أبقِ الـ try/catch pattern الموجود في الملف للألوان كمرجع لطريقة التعامل مع فشل الجلب.

---

## M1 — robots.ts + sitemap.ts الديناميكي

**الهدف:** محركات البحث تعرف ماذا تفهرس وماذا تتجاهل، وتكتشف كل الصفحات العامة تلقائياً.

### الملفات
| ملف | عملية |
|---|---|
| `app/robots.ts` | **جديد** |
| `app/sitemap.ts` | **جديد** |
| `lib/seo.ts` | إضافة دالة جلب روابط sitemap إن لزم |

### الخطوات
1. `app/robots.ts`:
   ```ts
   import type { MetadataRoute } from 'next'
   import { getSiteUrl } from '@/lib/seo'

   export default function robots(): MetadataRoute.Robots {
     return {
       rules: [{
         userAgent: '*',
         allow: '/',
         disallow: ['/admin', '/student', '/auth', '/api', '/*/watch/'],
       }],
       sitemap: `${getSiteUrl()}/sitemap.xml`,
     }
   }
   ```
2. `app/sitemap.ts` — ديناميكي بالكامل من الـ DB:
   - اجلب كل المراحل → كل فروعها → كل كورساتها (استخدم Supabase server client بنفس نمط `lib/student-lectures-data.ts`).
   - أدخل `/` بـ `priority: 1`، صفحات المراحل `0.9`، الفروع `0.8`، الكورسات `0.7`.
   - `changeFrequency: 'weekly'` للكورسات و `'monthly'` للباقي.
   - استخدم `absoluteUrl()` من `lib/seo.ts` لكل رابط.
3. **مهم:** الـ slugs عربية غالباً — `new URL()` يتكفل بالترميز. لا تعمل encode يدوي مزدوج.

### معايير القبول
- `curl -s localhost:3000/robots.txt` يعرض القواعد و رابط الـ sitemap.
- `curl -s localhost:3000/sitemap.xml` يعرض XML فيه كل صفحات المراحل/الفروع/الكورسات الفعلية من الـ DB.
- لا يظهر أي رابط `/admin` أو `/student` أو `/watch` في الـ sitemap.

### Gotchas
- `app/sitemap.ts` يعمل server-side — استخدم `@/lib/supabase/server` وليس client.
- لو فشل جلب الـ DB، أرجع على الأقل `[{ url: getSiteUrl(), ... }]` — لا ترمِ exception (الـ sitemap يجب ألا يكسر الـ build).

---

## M2 — استكمال metadata لكل الصفحات + noindex للخاص

**الهدف:** كل صفحة عامة عندها metadata كاملة (canonical/OG/description فريدة)، وكل صفحة خاصة `noindex`.

### الملفات
| ملف | عملية |
|---|---|
| `app/stages/[id]/page.tsx` | توسيع `generateMetadata` |
| `app/stages/[id]/[branchId]/page.tsx` | توسيع `generateMetadata` |
| `app/stages/[id]/[branchId]/[courseId]/page.tsx` | توسيع `generateMetadata` |
| `app/stages/[id]/[branchId]/[courseId]/watch/[lectureId]/page.tsx` | إضافة `robots: noindex` |
| `app/auth/page.tsx` | إضافة `robots: noindex` |
| `app/auth/error/page.tsx` | إضافة `robots: noindex` |
| `app/admin/layout.tsx` | إضافة `metadata = { robots: { index: false, follow: false } }` |
| `app/student/layout.tsx` | إضافة نفس الـ noindex |

### الخطوات
1. لكل صفحة stages، وسّع الـ return في `generateMetadata` الموجود ليشمل:
   ```ts
   return {
     title: stage.title,               // بدون اسم الموقع — القالب يضيفه
     description: '...',               // وصف فريد 150-160 حرف من بيانات الصفحة
     alternates: { canonical: `/stages/${id}` },   // المسار النسبي يكفي مع metadataBase
     openGraph: {
       title: stage.title,
       description: '...',
       url: `/stages/${id}`,
       type: 'website',
     },
     twitter: { card: 'summary_large_image', title: stage.title, description: '...' },
   }
   ```
2. الوصف (description) يُبنى من بيانات حقيقية: عدد الفروع/الكورسات، اسم المرحلة، اسم المدرّس من `getSiteContent()` إنوُجد.
3. للصفحات الخاصة أضف:
   ```ts
   export const metadata = { robots: { index: false, follow: false } }
   ```
   (أو داخل `generateMetadata` الموجود لو الصفحة عندها واحد فعلاً).
4. **تحقق من وجود `app/admin/layout.tsx` و `app/student/layout.tsx` أولاً** — لو غير موجودين أضف الـ noindex في صفحاتهما الرئيسية أو أنشئ layout بسيطاً يمرر children.

### معايير القبول
- مصدر أي صفحة stages يحتوي canonical + og:title + og:description + twitter:card.
- مصدر `/auth` وأي صفحة admin/student يحتوي `<meta name="robots" content="noindex, nofollow">`.
- لا يوجد أي title مكرر بين صفحتين مختلفتين.

### Gotchas
- الـ canonical بمسار نسبي يعمل فقط مع `metadataBase` (M0) — تأكد أن M0 منفّذة.
- الـ slugs العربية في `canonical`: مرّرها كما هي — Next.js يرمّزها تلقائياً.
- في `watch/[lectureId]` يوجد `generateMetadata` فعلاً — أضف `robots` داخله ولا تحذف الموجود.

---

## M3 — صور Open Graph (افتراضية + ديناميكية)

**الهدف:** أي رابط يُشارك على فيسبوك/واتساب/تويتر يظهر بصورة جذابة.

### الملفات
| ملف | عملية |
|---|---|
| `app/opengraph-image.png` | **جديد** — صورة افتراضية ثابتة 1200x630 |
| `app/stages/[id]/opengraph-image.tsx` | **جديد** — صورة ديناميكية بـ `next/og` |
| `app/stages/[id]/[branchId]/[courseId]/opengraph-image.tsx` | **جديد** — صورة ديناميكية للكورس |

### الخطوات
1. **الصورة الافتراضية:** أنشئ صورة PNG ثابتة 1200x630 بهوية المنصة (خلفية كحلية داكنة تتماشى مع ألوان الموقع `#1a1f33`، اسم المنصة بخط عربي كبير، عنصر رياضيات بسيط). ضعها في `app/opengraph-image.png` — Next.js يلتقطها تلقائياً لكل الصفحات التي لا تملك صورة خاصة.
2. **الصور الديناميكية** بـ `ImageResponse` من `next/og`:
   ```tsx
   import { ImageResponse } from 'next/og'
   export const size = { width: 1200, height: 630 }
   export const contentType = 'image/png'
   export default async function Image({ params }: { params: Promise<{ id: string }> }) {
     const { id } = await params
     const stage = await getStageBySlug(id)
     return new ImageResponse(
       (<div style={{ /* flex, خلفية داكنة, اسم المرحلة كبير */ }}>...</div>),
       { ...size }
     )
   }
   ```
3. **الخط العربي في ImageResponse:** حمّل خط Cairo كـ ArrayBuffer داخل الدالة (fetch من Google Fonts أو ملف محلي في `public/fonts/`) ومرّره في خيار `fonts`. بدونه النص العربي سيظهر مربعات.
4. أضف `alt` export لكل صورة ديناميكية.

### معايير القبول
- `curl -sI localhost:3000/opengraph-image` يرجع `200` و `image/png`.
- `curl -sI "localhost:3000/stages/<slug>/opengraph-image"` يرجع `200` ويعرض اسم المرحلة (تحقق بصرياً بفتحها في المتصفح).
- مصدر الصفحة يحتوي `og:image` يشير للصورة الصحيحة.

### Gotchas
- `ImageResponse` يدعم subset من CSS فقط — **flexbox فقط، لا grid**، ولا external CSS.
- `dir="rtl"` غير مدعوم مباشرة — استخدم `display: flex; flexDirection: 'row-reverse'` أو `textAlign: 'right'` للنص العربي.
- حجم الخط المُحمَّل يؤثر على زمن التوليد — استخدم weight واحد (700) يكفي.

---

## M4 — JSON-LD (البيانات المنظمة)

**الهدف:** ظهور نتائج غنية (rich results) في جوجل: منظمة تعليمية، كورسات، breadcrumbs.

### الملفات
| ملف | عملية |
|---|---|
| `components/seo/json-ld.tsx` | **جديد** — مكوّن عام `<JsonLd data={...} />` |
| `app/page.tsx` | إضافة `Organization` + `WebSite` |
| `app/stages/[id]/page.tsx` | إضافة `BreadcrumbList` |
| `app/stages/[id]/[branchId]/page.tsx` | إضافة `BreadcrumbList` |
| `app/stages/[id]/[branchId]/[courseId]/page.tsx` | إضافة `Course` + `BreadcrumbList` |

### الخطوات
1. المكوّن العام:
   ```tsx
   export function JsonLd({ data }: { data: Record<string, any> }) {
     return (
       <script
         type="application/ld+json"
         dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
       />
     )
   }
   ```
2. **الرئيسية** — `EducationalOrganization` (الاسم من `getSiteContent().seo.title`، الـ url من `getSiteUrl()`) + `WebSite`.
3. **صفحة الكورس** — schema `Course`:
   ```json
   {
     "@context": "https://schema.org",
     "@type": "Course",
     "name": "اسم الكورس",
     "description": "...",
     "provider": { "@type": "EducationalOrganization", "name": "...", "url": "..." },
     "inLanguage": "ar",
     "offers": { "@type": "Offer", "price": "...", "priceCurrency": "EGP" }
   }
   ```
   السعر موجود في بيانات الكورس (تحقق من الدالة الجالبة في الصفحة نفسها).
4. **BreadcrumbList** لكل صفحة عميقة: الرئيسية → المرحلة → الفرع → الكورس، بروابط مطلقة عبر `absoluteUrl()`.
5. ضع الـ `<JsonLd>` داخل الـ JSX للصفحة (server component) — لا تضعه في `<head>` يدوياً.

### معايير القبول
- مصدر كل صفحة يحتوي `<script type="application/ld+json">` بمحتوى صالح.
- الصق مصدر صفحة الكورس في [Rich Results Test](https://search.google.com/test/rich-results) (أو تحقق يدوياً أن JSON صالح بـ `JSON.parse`).
- لا أخطاء hydration في الـ console.

### Gotchas
- لا تحقن أي مدخلات مستخدم في JSON-LD بدون `JSON.stringify` (المكوّن العام يتكفل بذلك).
- `offers.price` يجب أن يكون string رقمي بدون رمز عملة.
- لو الكورس مجاني استخدم `"price": "0"` ولا تحذف الـ offers.

---

## M5 — manifest + أيقونات + صفحة 404

**الهدف:** هوية كاملة للموقع في المتصفح ومحركات البحث + تجربة 404 لا تخسر الزائر.

### الملفات
| ملف | عملية |
|---|---|
| `app/manifest.ts` | **جديد** |
| `app/icon.png` | **جديد** — 512x512 (يُستخدم أيضاً كـ favicon) |
| `app/apple-icon.png` | **جديد** — 180x180 |
| `app/not-found.tsx` | **جديد** — 404 مخصصة |

### الخطوات
1. `app/manifest.ts`: name/short_name من `getSiteContent().seo.title` (الدالة تدعم async)، `lang: 'ar'`, `dir: 'rtl'`, `theme_color: '#1a1f33'`, `background_color: '#f5f5f7'` (نفس قيم viewport الموجودة في layout)، والأيقونات.
2. أنشئ الأيقونات بهوية المنصة (رمز رياضيات على خلفية كحلية — متسقة مع صورة OG من M3).
3. `app/not-found.tsx`: صفحة 404 عربية RTL فيها رابط للرئيسية وروابط للمراحل الرئيسية (اجلبها من الـ DB أو ضع روابط ثابتة للمراحل الثلاث). صمّمها بنفس design tokens الموقع (`bg-background`, `text-foreground`).

### معايير القبول
- `curl -s localhost:3000/manifest.webmanifest` يرجع JSON صالح.
- الـ favicon يظهر في تبويب المتصفح.
- زيارة رابط غير موجود (مثل `/xyz`) تعرض صفحة الـ 404 المخصصة بحالة HTTP 404.

### Gotchas
- ملفات `app/icon.png` و `app/apple-icon.png` تُلتقط تلقائياً بالاسم — لا تحتاج أي config.
- `not-found.tsx` في الـ root يلتقط كل الـ 404 — لا تنشئ واحداً لكل مسار.

---

## M6 — تحسينات تقنية: semantic HTML + الصور + الأداء

**الهدف:** رفع جودة الفهرسة و Core Web Vitals (LCP/CLS/INP) للصفحات العامة.

### الخطوات (افحص ثم أصلح — صفحة صفحة)
1. **هيكل العناوين:** لكل صفحة عامة تأكد من وجود `<h1>` واحد فقط يحتوي الكلمة المفتاحية الأساسية (اسم المرحلة/الكورس)، وتسلسل `h2/h3` منطقي بدون قفزات. افحص `components/landing/**` و `components/stages/**`.
2. **الصور:**
   - كل `<img>` أو `<Image>` في الصفحات العامة عنده `alt` عربي وصفي (ليس فارغاً إلا للزخرفية).
   - الصورة الأولى فوق الـ fold (hero) عندها `priority` في `next/image`.
   - أي `<img>` عادي في الصفحات العامة حوّله لـ `next/image` مع أبعاد صريحة (يمنع CLS).
3. **الروابط الداخلية:** تأكد أن بطاقات المراحل/الفروع/الكورسات تستخدم `<Link href>` حقيقي (وليس `onClick` + router.push) — الزاحف يتبع `<a>` فقط.
4. **الخطوط:** الخطوط تُحمَّل فعلاً عبر `next/font` (Cairo/Aref Ruqaa/Geist Mono + خط محلي) — تأكد أن الخط المحلي `lemon-brush-arabic.otf` عنده `display: 'swap'` (موجود فعلاً، لا تغيّره).
5. **قياس:** شغّل `agent-browser vitals "http://localhost:3000" --json` و للصفحات الرئيسية وسجّل LCP/CLS. أصلح أي CLS > 0.1 (غالباً صور بدون أبعاد) وأي LCP > 2.5s (غالباً صورة hero بدون priority).

### معايير القبول
- كل صفحة عامة: `h1` واحد بالضبط (تحقق: `document.querySelectorAll('h1').length === 1`).
- صفر صور بدون `alt` في الصفحات العامة.
- CLS < 0.1 و LCP معقول في بيئة الاختبار للرئيسية وصفحة مرحلة وصفحة كورس.

### Gotchas
- لا تغيّر تصميم أي مكوّن — التعديلات هنا هيكلية فقط (تاجات و attributes).
- بعض مكوّنات اللاندنج قد تستخدم `h1` للشعار و `h1` آخر للعنوان — وحّدها: الشعار `<p>` أو `<div>`، العنوان الرئيسي `<h1>`.

---

## M7 — إعدادات SEO في الأدمن + التحقق النهائي

**الهدف:** المدرّس يتحكم في نصوص SEO من لوحة الأدمن، وقائمة تحقق نهائية شاملة.

### الخطوات
1. **افحص `app/admin/settings`** — يوجد فعلاً تحرير لـ `seo.title` و `seo.description` (عبر `site_content`). وسّعه ليشمل:
   - حقل "كلمات مفتاحية" (تُستخدم في descriptions المولّدة).
   - حقل "كود التحقق من Google Search Console" → يُحقن في root layout عبر `verification: { google: '...' }` في الـ metadata.
2. أضف الحقول الجديدة لـ `SeoContent` type في `lib/site-content.ts` وللـ `DEFAULT_SITE_CONTENT` — النمط موجود، اتبعه.
3. **قائمة التحقق النهائية** (نفّذها كلها وسجّل النتائج):
   - [ ] `/robots.txt` صحيح ويشير للـ sitemap
   - [ ] `/sitemap.xml` يحتوي كل الصفحات العامة ولا يحتوي أي صفحة خاصة
   - [ ] كل صفحة عامة: title فريد + description فريدة + canonical + og:image
   - [ ] كل صفحة خاصة: noindex
   - [ ] JSON-LD صالح في الرئيسية وصفحات الكورسات
   - [ ] manifest + أيقونات تعمل
   - [ ] 404 مخصصة تعمل بحالة 404
   - [ ] `pnpm exec tsc --noEmit` نظيف
   - [ ] `pnpm build` ينجح بدون أخطاء
4. **وثّق للمستخدم** (في رسالة الإنهاء، ليس ملفاً): خطوات ما بعد النشر — إضافة الموقع في Google Search Console، إرسال الـ sitemap، ضبط `NEXT_PUBLIC_SITE_URL` في Vercel.

### معايير القبول
- حفظ الحقول الجديدة من الأدمن يعمل ويظهر أثرها في مصدر الصفحة.
- كل بنود قائمة التحقق خضراء.

---

## ترتيب التنفيذ والتبعيات

```
M0 (الأساس) ──→ M1 (robots/sitemap) ──→ M2 (metadata لكل صفحة)
                                              │
                                              ▼
              M4 (JSON-LD) ←── M3 (صور OG)
                                              │
                                              ▼
              M5 (manifest/404) ──→ M6 (تقني/أداء) ──→ M7 (أدمن + تحقق)
```

- **M0 قبل الكل** — كل شيء يعتمد على `getSiteUrl()` و `metadataBase`.
- **M2 قبل M3/M4** — الـ metadata الأساسية يجب أن تكتمل قبل الصور والبيانات المنظمة.
- **M7 آخر شيء** — التحقق النهائي بعد اكتمال كل شيء.

## متغيرات البيئة المطلوبة

| المتغير | متى | ملاحظة |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | قبل النشر للإنتاج | مثال: `https://example.com` — بدونه يستخدم fallback تلقائي |

## قيود صريحة

- **لا اختبار على دومين حقيقي** — التحقق من Search Console والـ rich results الفعلية يتم بعد النشر بواسطة المستخدم.
- **لا تغييرات تصميمية** — أي تعديل مرئي (404، أيقونات) يتبع design tokens الموجودة.
- **لا مكتبات خارجية جديدة** — كل شيء بـ Next.js Metadata API المدمجة و `next/og`.
