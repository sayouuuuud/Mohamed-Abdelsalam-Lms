# خطة تنفيذ: حسابات المساعدين (Assistant Accounts)

> الهدف: إنشاء نوع حساب جديد اسمه "مساعد" (assistant) هو نفس لوحة تحكم الأدمن،
> لكن الأدمن هو اللي بيتحكم في **الصفحات** اللي المساعد يقدر يوصلها ومستوى
> صلاحيته على كل صفحة (**ممنوع / عرض فقط / تحكم كامل**). الإدارة بتتم من جوه
> **صفحة الإعدادات**، والصلاحيات بتتطبق على **3 طبقات**: الواجهة (sidebar/UI)،
> الراوت (middleware + page guards)، وقاعدة البيانات (RLS).

---

## 1) المفاهيم الأساسية

### الأدوار (roles)
- `student` — طالب (زي ما هو).
- `admin` — مدير كامل الصلاحيات، وهو الوحيد اللي يقدر يدير المساعدين.
- `assistant` — **جديد**: بيدخل نفس لوحة `/admin/*` لكن بصلاحيات محدودة.

### الموارد (resources / pages)
قائمة موحّدة بتطابق عناصر الـ sidebar، كل عنصر له `key` ثابت:

| key | الصفحة | المسار |
|-----|--------|--------|
| `dashboard` | الصفحة الرئيسية | `/admin/dashboard` |
| `students` | الطلاب | `/admin/students` |
| `categories` | التصنيفات | `/admin/categories` |
| `courses` | المحاضرات | `/admin/courses` |
| `exams` | الاختبارات | `/admin/exams` |
| `calendar` | التقويم | `/admin/calendar` |
| `payments` | الطلبات | `/admin/payments` |
| `messages` | الرسائل | `/admin/messages` |
| `notifications` | الإشعارات | `/admin/notifications` |
| `coupons` | الخصومات والكوبونات | `/admin/coupons` |
| `reports` | التقارير | `/admin/reports` |
| `settings` | الإعدادات | `/admin/settings` |

> ملاحظة: `settings` هيتقسم داخلياً — تبويب "المساعدين" (إدارة الفريق) هيكون
> **حصري للأدمن** حتى لو المساعد عنده صلاحية على باقي الإعدادات.

### مستويات الصلاحية (access levels)
لكل مورد، للمساعد واحد من:
- `none` — ممنوع تماماً (مش بيظهر في الـ sidebar ولا يقدر يفتح الراوت).
- `view` — عرض فقط (يشوف البيانات لكن كل أزرار/أفعال الإضافة/التعديل/الحذف مقفولة).
- `manage` — تحكم كامل (زي الأدمن على الصفحة دي).

الأدمن دايماً = `manage` على كل حاجة (implicit، مش محتاج صفوف).

---

## 2) تغييرات قاعدة البيانات (كلها في `scripts/` — تشغّلها يدوياً على الـ live DB)

### ملف: `scripts/assistant_accounts.sql`

**(أ) توسعة قيم الـ role**
- التأكد إن عمود `profiles.role` يقبل `'assistant'` (لو فيه CHECK constraint نوسّعه، لو نصّي حر مفيش مشكلة).

**(ب) جدول صلاحيات المساعدين**
```sql
create table if not exists public.assistant_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  resource text not null,          -- 'students' | 'courses' | ...
  access_level text not null default 'none'
    check (access_level in ('none','view','manage')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (profile_id, resource)
);
create index if not exists idx_assistant_permissions_profile
  on public.assistant_permissions(profile_id);
```

**(ج) دوال مساعدة للـ RLS**
```sql
-- هل المستخدم الحالي أدمن؟ (موجودة، هنسيبها زي ما هي)
-- public.is_admin()

-- هل المستخدم الحالي أدمن كامل (super) — للتفريق في تبويب المساعدين
create or replace function public.is_full_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

-- هل عند المستخدم صلاحية على مورد بمستوى معيّن أو أعلى؟
-- admin => true دايماً. assistant => حسب صف assistant_permissions.
create or replace function public.has_permission(p_resource text, p_level text)
returns boolean language sql stable security definer set search_path=public as $$
  select
    public.is_full_admin()
    or exists (
      select 1 from public.assistant_permissions ap
      join public.profiles pr on pr.id = ap.profile_id
      where ap.profile_id = auth.uid()
        and pr.role = 'assistant'
        and ap.resource = p_resource
        and (
          ap.access_level = 'manage'
          or (p_level = 'view' and ap.access_level in ('view','manage'))
        )
    );
$$;
```

**(د) تحديث سياسات RLS (الطبقة الثالثة)**
لكل جدول مرتبط بمورد، نستبدل الشرط `is_admin()` بـ:
- **قراءة (SELECT):** `has_permission('<resource>','view')`
- **كتابة (INSERT/UPDATE/DELETE):** `has_permission('<resource>','manage')`

خريطة الجداول ↔ المورد (مبدئية، تتأكد وقت التنفيذ):
- `students`, `enrollments` ↔ `students`
- `categories` (أو `branches`/`stages`) ↔ `categories`
- `lectures`, `lessons`, `assignments`, `assignment_questions` ↔ `courses`
- `exams`, `exam_questions`, `exam_attempts` ↔ `exams`
- `calendar_events` ↔ `calendar`
- `orders`, `order_items` ↔ `payments`
- `messages` ↔ `messages`
- `notifications` ↔ `notifications`
- `coupons` ↔ `coupons`
- `settings`, `site_content` ↔ `settings`

> مهم: `assistant_permissions` نفسه يتحمي بـ RLS: القراءة/الكتابة عليه
> لـ `is_full_admin()` فقط (الأدمن الكامل بس). والمساعد يقدر يقرأ **صفوفه هو**
> فقط (عشان الواجهة تعرف صلاحياته) لكن **مايعدّلهاش**.

> ملاحظة الاتساق: `has_permission` بتعمل الأمان الحقيقي على مستوى الـ DB،
> فحتى لو حصل خطأ في الواجهة، المساعد مش هيقدر يعدّل بيانات مالوش عليها `manage`.

---

## 3) طبقة الكود المشتركة (Helpers)

### ملف جديد: `lib/permissions.ts`
- تعريف ثابت `RESOURCES` (نفس جدول القسم 1) — key + label + icon + href.
- أنواع TypeScript: `Resource`, `AccessLevel = 'none'|'view'|'manage'`.
- `mapPathToResource(pathname)` — يحوّل `/admin/courses/123` ➜ `courses`.

### تعديل: `lib/auth-guard.ts`
- `getCurrentRole(supabase)` — يرجّع `'admin' | 'assistant' | 'student' | null`.
- `getAssistantPermissions(supabase)` — يرجّع `Record<Resource, AccessLevel>`
  (للأدمن: الكل `manage`).
- `requireAccess(supabase, resource, level)` — يرمي/يـ redirect لو مفيش صلاحية.
- `requireAdmin` تفضل موجودة لكن تتوسّع: تقبل admin **و** assistant للدخول العام
  للوحة، وبعدين كل صفحة تستدعي `requireAccess` بموردها.

---

## 4) طبقة الراوت (middleware + page guards)

### تعديل: `middleware.ts`
- بعد التأكد إن المستخدم داخل: لو المسار `/admin/*`:
  - لو الدور `student` ➜ redirect لـ `/student`.
  - لو الدور `assistant` ➜ نحسب المورد من المسار، ونتأكد إن صلاحيته
    != `none`، وإلا redirect لأول صفحة مسموح بيها (أو صفحة "غير مصرّح").
- الأدمن يعدّي عادي.

### تعديل كل صفحة `/admin/<x>/page.tsx`
- استدعاء `requireAccess(supabase, '<resource>', 'view')` في أول الصفحة (RSC).
- تمرير `accessLevel` للمكوّن عشان الواجهة تخفي أزرار التعديل لو `view`.

---

## 5) طبقة الواجهة (UI)

### تعديل: `components/dashboard/sidebar.tsx`
- استقبال `permissions` (من الـ layout) وفلترة العناصر: نعرض بس اللي
  صلاحيتها != `none`. (الأدمن يشوف الكل.)
- تبويب/عنصر "الإعدادات" يفضل يظهر لو عنده أي صلاحية عليه.

### تعديل: `app/admin/layout.tsx` (أو الـ layout الأب)
- تحميل الدور + الصلاحيات مرة واحدة وتمريرها للـ sidebar.

### إخفاء أزرار التعديل عند `view`
- في صفحات زي `students`, `courses`, `exams`... نمرّر `canManage` (=`level==='manage'`)
  ونخفي/نعطّل أزرار: إضافة، تعديل، حذف، نشر، رفع ملفات... إلخ.

---

## 6) إدارة المساعدين (داخل الإعدادات)

### تعديل: `components/settings/settings-panel.tsx`
- إضافة تبويب جديد **"المساعدين"** (`assistants`) بأيقونة `UsersRound`.
- التبويب ده **يظهر للأدمن الكامل فقط** (`is_full_admin`).

### مكوّن جديد: `components/settings/assistants-tab.tsx`
واجهة فيها:
- **قائمة المساعدين الحاليين** (الاسم، الإيميل، عدد الصفحات المسموح بيها، أزرار تعديل/حذف).
- **زر "إضافة مساعد"** ➜ modal:
  - الاسم، الإيميل، كلمة المرور (إنشاء حساب auth + profile بـ role=assistant).
  - جدول صلاحيات: كل مورد وجنبه اختيار (ممنوع / عرض / تحكم كامل).
- **تعديل صلاحيات مساعد موجود** ➜ نفس جدول الصلاحيات.
- **حذف مساعد** (يحوّله لـ student أو يحذف الحساب — يتحدد وقت التنفيذ).

### ملف جديد: `app/admin/settings/assistants-actions.ts` (server actions)
- `listAssistants()` — للأدمن فقط.
- `createAssistant({ name, email, password, permissions })`:
  - إنشاء المستخدم عبر Supabase Admin API (service role) — إنشاء `profile`
    بـ role=`assistant` + إدخال صفوف `assistant_permissions`.
- `updateAssistantPermissions(profileId, permissions)`.
- `deleteAssistant(profileId)`.
- كل الدوال تبدأ بـ `requireFullAdmin()` (حماية سيرفر).

> ملاحظة: إنشاء مستخدم auth محتاج **service role key**. نتأكد إنه متوفر في
> env (`SUPABASE_SERVICE_ROLE_KEY`) قبل التنفيذ، وكل الاستدعاءات دي server-only.

---

## 7) التوجيه بعد تسجيل الدخول
- تعديل منطق الـ redirect: `admin` **و** `assistant` ➜ `/admin/...`
  (المساعد يروح لأول صفحة مسموح بيها له)، و`student` ➜ `/student`.

---

## 8) ترتيب التنفيذ المقترح

1. **DB:** كتابة `scripts/assistant_accounts.sql` (الجدول + الدوال + RLS) — تشغّله يدوياً.
2. **Helpers:** `lib/permissions.ts` + توسعة `lib/auth-guard.ts`.
3. **إدارة المساعدين:** `assistants-actions.ts` + تبويب "المساعدين" في الإعدادات (عشان نقدر ننشئ مساعد ونختبر).
4. **الراوت:** تحديث `middleware.ts` + guards في صفحات `/admin/*`.
5. **الواجهة:** فلترة الـ sidebar + إخفاء أزرار التعديل عند `view`.
6. **التوجيه:** تحديث redirect بعد الدخول.
7. **اختبار:** إنشاء مساعد بصلاحيات مختلفة والتأكد من الـ 3 طبقات.

---

## 9) نقاط تحتاج قرار قبل/أثناء التنفيذ
- **حذف مساعد:** نحوّله `student` ونحذف صلاحياته؟ ولا نحذف حساب auth كامل؟
- **صفحات فرعية:** بعض الموارد فيها راوتات تفصيلية (زي `/admin/courses/[id]`) —
  الصلاحية بتتوارث من المورد الأب (`courses`) وده الافتراض في الخطة.
- **الموارد بدون RLS مباشر:** لو فيه صفحة بتعتمد على أكتر من جدول، نراجع كل
  الجداول المرتبطة وقت التنفيذ.
- **الأدمن الكامل الوحيد:** تبويب المساعدين + الإعدادات الحسّاسة تفضل حصري
  لـ `role='admin'`.
