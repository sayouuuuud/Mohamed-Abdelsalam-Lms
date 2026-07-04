# Public Pages — Types, Data & API Reference

> الصفحات الخارجية فقط: الرئيسية، المراحل، الدرس التجريبي، صفحة الدخول، السلة، والكوبونات.
> لا يوجد كود UI أو styling.

---

## 1. TypeScript Interfaces

### المنهج (Curriculum)

```ts
type Lesson = {
  id: string           // slug
  title: string
  duration: string     // "14:30"
  isFree?: boolean
}

type Lecture = {
  id: string           // slug
  dbId?: string        // UUID في قاعدة البيانات (متاح عند التحميل من DB)
  title: string
  description: string
  price: number
  oldPrice?: number
  badge?: string
  image?: string
  lessons: Lesson[]
}

type Branch = {
  id: string           // slug
  title: string
  description: string
  image: string
  topics: string[]
  lectures: Lecture[]
}

type Stage = {
  id: string           // slug
  index: string        // "٠١"
  title: string
  subtitle: string
  rows: string[]
  formula: string
  image: string
  accent: 'gold' | 'emerald'
  termPrice: number
  termOldPrice?: number
  branches: Branch[]
}
```

### Row Types الداخلية (DB → App mapping في `lib/curriculum.ts`)

```ts
type StageRow  = { id, slug, idx, title, subtitle, rows, formula, image, accent, term_price, term_old_price }
type BranchRow = { id, stage_id, slug, title, description, image, topics }
type LectureRow= { id, branch_id, slug, title, description, price, old_price, badge, image }
type LessonRow = { id, lecture_id, slug, title, duration, is_free }
```

### السلة والطلبات

```ts
type CartItem = {
  lectureId: string
  title: string
  branchTitle: string
  stageTitle: string
  price: number
}

// input لـ createOrder
type OrderInput = {
  name: string
  phone: string
  method: string       // "فودافون كاش" | "انستاباي" | "مجاني"
  reference?: string
  note?: string
  receiptUrl?: string
  couponCode?: string
}
```

### البيانات الثابتة (Static Data في `lib/landing-data.ts`)

```ts
type Feature = {
  step: string         // "٠١"
  title: string
  description: string
  icon: string
}

type Stat = {
  value: number
  suffix: string       // "+" | "%"
  label: string
}

type Testimonial = {
  name: string
  grade: string
  subject: string
  quote: string
  before: number       // درجة قبل (%)
  after: number        // درجة بعد (%)
  journey: { month: string; score: number }[]
}
```

---

## 2. Server Actions & Data Functions

### `lib/curriculum.ts` — قراءة المنهج من DB

| الدالة | المصدر | الإرجاع |
|---|---|---|
| `getCurriculum()` | `stages`, `branches`, `lectures`, `lessons` | `Stage[]` |
| `getStageBySlug(slug)` | يستدعي `getCurriculum()` | `Stage \| undefined` |
| `getBranchBySlug(stageSlug, branchSlug)` | يستدعي `getCurriculum()` | `{ stage, branch } \| undefined` |

> `getCurriculum` تعمل 4 queries بالتوازي (`Promise.all`) وتجمّعهم في الذاكرة.

---

### `app/cart-actions.ts` — السلة والطلبات

| الدالة | الجدول | الوصف |
|---|---|---|
| `getCartItems()` | `cart_items` + join `lectures→branches→stages` | يرجع السلة الحالية أو `null` لو مش مسجّل |
| `addToCart(lectureId)` | `cart_items` / `orders` + `order_items` | يضيف للسلة، أو يسجّل تلقائيًا لو المحاضرة مجانية |
| `removeFromCart(lectureId)` | `cart_items` | يحذف عنصر من السلة |
| `getCheckoutDefaults()` | `profiles` | يرجع اسم/تليفون/إيميل من الـ profile |
| `createOrder(input)` | `orders` + `order_items` + `cart_items` | ينشئ طلب، يطبّق الكوبون، يفرّغ السلة |

#### منطق `addToCart` للمحاضرات المجانية
```
price === 0 → ينشئ order بـ status='approved' مباشرة (بدون انتظار موافقة)
           → يضيف order_item
           → لا يضيف للسلة
```

#### منطق `createOrder`
```
1. getCartItems()
2. computeCoupon() server-side (لو في كوبون)
3. total = subtotal - discount
4. INSERT orders (status='pending')
5. INSERT order_items
6. increment_coupon_used() RPC (best-effort)
7. DELETE cart_items للمستخدم
```

---

### `app/coupon-actions.ts`

| الدالة | الجدول | الوصف |
|---|---|---|
| `computeCoupon(supabase, code, items)` | `coupons` | يتحقق من صلاحية الكوبون ويحسب الخصم |

---

## 3. Static Data (ثابتة — لا تأتي من DB)

الملف: `lib/landing-data.ts`

| المتغير | النوع | الوصف |
|---|---|---|
| `stages` | `Stage[]` | بيانات المراحل الثلاث (fallback قبل ربط DB) |
| `features` | `Feature[]` | 4 مميزات للصفحة الرئيسية |
| `stats` | `Stat[]` | أرقام الإحصاء (48k طالب، 98%، إلخ) |
| `testimonials` | `Testimonial[]` | 3 قصص نجاح مع بيانات الرحلة الدراسية |
| `equations` | `string[]` | معادلات للزينة في الخلفية |

> **تنبيه:** `stages` في `landing-data.ts` هي بيانات hardcoded قديمة. الصفحة الرئيسية الحالية تستخدم `getCurriculum()` من `lib/curriculum.ts` اللي بتجيب البيانات الحقيقية من Supabase.

---

## 4. Auth Flow (صفحة `/auth`)

```
زائر يفتح /auth
  └─ مسجّل دخول؟
       ├─ role === 'admin' → redirect /admin/dashboard
       └─ غير ذلك        → redirect /student

?mode=register → initialTab = 'register'
?mode=login    → initialTab = 'login'  (default)
```

---

## 5. جداول Supabase المستخدمة

| الجدول | الاستخدام |
|---|---|
| `stages` | المراحل الدراسية |
| `branches` | الأبواب داخل كل مرحلة |
| `lectures` | المحاضرات داخل كل باب |
| `lessons` | الدروس داخل كل محاضرة |
| `cart_items` | عناصر سلة المستخدم الحالي |
| `orders` | الطلبات المدفوعة أو قيد المراجعة |
| `order_items` | محاضرات كل طلب |
| `coupons` | كوبونات الخصم |
| `profiles` | بيانات الملف الشخصي (اسم، تليفون، إيميل) |
