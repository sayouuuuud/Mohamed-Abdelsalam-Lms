# خطة تنفيذ نظام المراقبة الشامل (Audit & Activity Monitoring)

> **STATUS: مكتمل بالكامل — 7/7 milestones منتهية** (تاريخ: 2026-07-06)
>
> **موجّهة إلى الموديل المنفّذ (Sonnet):** اقرأ الخطة دي كاملة قبل ما تبدأ. نفّذ milestone واحد في كل مرة وبالترتيب. لا تنتقل لmilestone جديد قبل ما تتأكد إن الحالي مكتمل ومتحقق منه بـ type-check. التزم حرفياً بقواعد المشروع المذكورة في قسم "قواعد إلزامية".

---

## قواعد إلزامية (من تعليمات صاحب المشروع)

1. **ممنوع تشغيل أي SQL عبر الـ Supabase MCP** — الـ MCP متصل بقاعدة بيانات قديمة. أي تغيير في الداتا بيز يُكتب في **ملف SQL داخل مجلد `scripts/`** وصاحب المشروع هو اللي يشغّله يدوياً على الـ live DB.
2. **الـ live DB هي المصدر الحقيقي** — اعتمد على ملفات الـ migration في `scripts/` لفهم بنية الجداول، مش على الـ MCP.
3. سيرفر التطوير شغّال بـ **mock data** بدون اتصال DB فعلي — اختبر على مستوى الكود والـ type-check فقط، وصاحب المشروع يتحقق بعد تشغيل الـ SQL.
4. **ممنوع مسح أي feature** موجودة إلا بطلب صريح.
5. كل تعديل ملفات بأدوات Edit/Write، والمسارات كلها absolute من `/vercel/share/v0-project/`.

---

## 1) نطاق النظام (متفق عليه مع صاحب المشروع)

| القرار | الاختيار |
|---|---|
| مين يتسجّل نشاطه؟ | **الأدمن والمساعدين معاً** (كل فريق الإدارة) |
| مستوى التفاصيل | **الفعل فقط** — بدون تخزين before/after diff |
| تتبع الدخول | **نعم**: login/logout + IP + user agent (الجهاز) |
| الأفعال المتتبعة | **الكتابة فقط**: إضافة / تعديل / حذف (بدون تسجيل القراءات) |
| مين يشوف السجل؟ | **الأدمن الكامل فقط** (role = admin). المساعد لا يرى السجل نهائياً |
| طبيعة السجل | **Append-only** — لا تعديل ولا حذف لأي صف، حتى من الأدمن |

---

## 2) السياق المعماري الحالي (اقرأه كويس قبل التنفيذ)

النظام مبني على Next.js (App Router) + Supabase، بلوحة أدمن RTL بالعربي.

### بنية الصلاحيات الموجودة (اتبنت قبل كده — لا تلمسها، ابنِ فوقها):
- **الأدوار:** `admin` / `assistant` / `student` في عمود `profiles.role`.
- **جدول `assistant_permissions`:** صلاحيات المساعد لكل مورد بمستويات `none/view/manage` (سكريبته في `scripts/assistant_accounts.sql`).
- **مفاتيح الموارد** معرّفة في `lib/permissions.ts` (`RESOURCES` + `ResourceKey`): dashboard, students, categories, courses, exams, calendar, payments, messages, notifications, coupons, reports, settings. **استخدم نفس المفاتيح دي في تسجيل النشاط** عشان الاتساق.
- **`lib/auth-guard.ts`:** فيه `requireAdmin` (أدمن كامل)، `isStaff` (أدمن أو مساعد)، `hasResourceAccess(supabase, resource, level)` (الـ guard الأساسي في كل السيرفر أكشنز)، و`getPermissionMap`.
- **كل عمليات الكتابة** في `app/admin/**/actions.ts` محمية بـ `hasResourceAccess(..., 'manage')`. القراءات بـ `view`.
- **الـ middleware** (`lib/supabase/proxy.ts`): بيحمي `/admin` حسب الدور والصلاحيات.
- **صفحة الإعدادات** فيها تبويبات (`components/settings/settings-panel.tsx`) — تبويب "المساعدون" (`assistants-tab.tsx`) يظهر للأدمن الكامل فقط عبر prop اسمه `isFullAdmin`. الأكشنز في `app/admin/settings/assistants-actions.ts`.
- **الـ sidebar** (`components/dashboard/sidebar.tsx`): عناصر nav لكل مورد، بتتفلتر حسب `PermissionMap`.
- **مسارات المصادقة** (3 أماكن فيها redirect بعد الدخول): `app/auth/page.tsx`, `app/auth/callback/route.ts`, `components/auth/auth-form.tsx`.

### نقطة أمان مهمة موثّقة في `scripts/assistant_accounts.sql`:
جداول أساسية كتير (students, courses, lectures, orders...) **مفيش RLS مفعّل عليها**، والحماية الفعلية هي طبقة التطبيق (الـ guards). **جدول السجل الجديد لازم يكون عليه RLS مفعّل من أول يوم** لأنه جدول جديد ومفيش حاجة تنكسر.

---

## 3) التصميم العام للنظام

### المكونات الأربعة:
1. **طبقة التخزين (DB):** جدولان جديدان — سجل النشاط + سجل الدخول.
2. **طبقة التسجيل (Instrumentation):** دالة logger مركزية تُستدعى من كل سيرفر أكشن كتابة، وتسجيل الدخول من مسارات المصادقة.
3. **طبقة العرض (UI):** صفحة مراقبة جديدة `/admin/activity` للأدمن الكامل فقط.
4. **طبقة الأمان:** RLS append-only + إخفاء الصفحة عن المساعدين في middleware والـ sidebar.

### مبادئ تصميم إلزامية:
- **التسجيل لا يكسر العملية الأساسية أبداً:** لو فشل تسجيل اللوج (خطأ DB مثلاً)، العملية الأصلية (إضافة طالب مثلاً) لازم تكمل عادي. غلّف كل استدعاء للـ logger بـ try/catch صامت (أو `.catch()` بدون await blocking).
- **Fire-and-forget قدر الإمكان:** التسجيل ما يبطّأش الاستجابة.
- **الكتابة عبر service role:** الـ logger يكتب بـ `createAdminClient()` (موجود في `lib/supabase/admin.ts`) عشان RLS الـ append-only ما يمنعش الإدراج، ومفيش سياسة insert للمستخدمين العاديين أصلاً.
- **snapshot للهوية:** خزّن `actor_role` و`actor_name` وقت الحدث (مش join وقت العرض بس) — لأن الدور والاسم ممكن يتغيروا.
- **`target_label` نصي:** خزّن وصف مقروء للهدف ("الطالب أحمد - 1023"، "محاضرة الفيزياء - الباب الأول") عشان الـ feed يتقرا من غير joins معقدة حتى لو الهدف اتمسح.

---

## Milestone 1: طبقة قاعدة البيانات (ملف SQL فقط — بدون أي تشغيل)

**الهدف:** ملف `scripts/audit_system.sql` كامل وجاهز للتشغيل اليدوي.

**المطلوب في الملف:**

1. **جدول `activity_logs`** بالأعمدة:
   - `id` (uuid, pk, default random)
   - `actor_id` (uuid, يشير لـ profiles، **بدون** on delete cascade — استخدم `on delete set null` وخلّيه nullable، عشان مسح مساعد ما يمسحش تاريخه)
   - `actor_name` (text) — snapshot لاسم الفاعل وقت الحدث
   - `actor_role` (text) — snapshot للدور: admin أو assistant
   - `action` (text + check constraint): `create` / `update` / `delete` / `approve` / `reject` — لاحظ إن approve/reject مهمين لسؤال "مين قبل معاملة الطالب" (قبول/رفض الطلبات في payments)
   - `resource` (text) — نفس مفاتيح `ResourceKey` في `lib/permissions.ts`
   - `target_id` (text, nullable) — معرّف العنصر المتأثر (نصي مش uuid عشان المرونة)
   - `target_label` (text, nullable) — وصف مقروء بالعربي
   - `details` (text, nullable) — جملة وصفية اختيارية للفعل ("غيّر حالة الطالب إلى موقوف")
   - `created_at` (timestamptz default now)
2. **جدول `auth_logs`** بالأعمدة:
   - `id`, `actor_id` (نفس منطق set null), `actor_name`, `actor_role`
   - `event` (text + check): `login` / `logout`
   - `ip` (text, nullable), `user_agent` (text, nullable)
   - `created_at`
3. **Indexes:** على `activity_logs(created_at desc)`, `activity_logs(actor_id)`, `activity_logs(resource)`, `activity_logs(target_id)`, و`auth_logs(created_at desc)`, `auth_logs(actor_id)`.
4. **RLS على الجدولين (مفعّل إلزامياً):**
   - سياسة **select للأدمن الكامل فقط** (استخدم دالة `is_full_admin()` الموجودة من سكريبت المساعدين — لو مش موجودة على الـ live لسه، السكريبت ده لازم يعيد تعريفها بـ `create or replace` عشان يشتغل مستقلاً).
   - **بدون أي سياسة insert/update/delete** لأي دور — الكتابة هتتم حصرياً عبر service role اللي بيتخطى RLS. كده الجدول append-only فعلياً من ناحية العملاء.
5. تعليقات واضحة في السكريبت تشرح كل قسم، وترويسة تقول إن التشغيل يدوي على الـ live DB.

**التحقق:** مراجعة السكريبت syntax-wise فقط. ممنوع تشغيله عبر MCP.

---

## Milestone 2: الـ Logger المركزي (`lib/audit-log.ts`)

**الهدف:** نقطة تسجيل واحدة يستدعيها كل الكود.

**المطلوب:**

1. ملف جديد `lib/audit-log.ts` (server-only) فيه:
   - دالة `logActivity(params)` — بتاخد: `action`, `resource`, `targetId?`, `targetLabel?`, `details?`.
   - جوّاها: تجيب المستخدم الحالي من `createClient()` (سيشن)، تجيب اسمه ودوره من `profiles`، **تتجاهل الطلاب** (لو الدور مش admin/assistant ترجع بدون تسجيل)، وتكتب الصف عبر `createAdminClient()`.
   - **معالجة أخطاء صامتة:** أي خطأ جوّا الدالة يتلقّف ويتسجّل بـ `console.error` فقط — **لا يُرمى أبداً** للمستدعي.
   - دالة `logAuthEvent(params)` — بتاخد: `event` (login/logout), `actorId`, `ip?`, `userAgent?` — بنفس منطق الصمت. (بتاخد actorId صريح لأن وقت الـ login/logout السيشن ممكن ما تكونش جاهزة/لسه موجودة).
2. استخراج الـ IP والـ user agent: من headers الطلب (`x-forwarded-for` أول قيمة، و`user-agent`) — دالة helper صغيرة في نفس الملف تستخدم `headers()` من `next/headers` (لاحظ إنها async في Next.js 16 — لازم await).

**التحقق:** type-check نظيف.

---

## Milestone 3: تسجيل الدخول والخروج (Auth instrumentation)

**الهدف:** كل login/logout للأدمن والمساعدين يتسجّل بـ IP وجهاز.

**المطلوب:**

1. **الدخول:** فيه 3 مسارات مصادقة — حدد فين فعلياً بيتم `signInWithPassword` (الأرجح `components/auth/auth-form.tsx` client-side و/أو `app/auth/callback/route.ts`). بما إن الـ IP والـ headers متاحين server-side فقط:
   - لو الدخول client-side: أضف **server action** صغيرة (مثلاً في `app/auth/actions.ts` أو ملف جديد) اسمها `recordLogin()` تُستدعى بعد نجاح الدخول مباشرة، تجيب المستخدم من السيشن وتسجّل الحدث بالـ headers. استدعاؤها fire-and-forget من الـ client (بدون تعطيل الـ redirect).
   - في `app/auth/callback/route.ts` (OAuth/email flows): سجّل مباشرة بعد نجاح تبادل الكود، **فقط** لو الدور admin/assistant.
2. **الخروج:** دوّر على منطق الـ logout الحالي (ابحث عن `signOut` في المشروع — غالباً في header الأدمن أو hook). أضف تسجيل `logout` قبل تنفيذ الـ signOut (عشان السيشن تكون لسه موجودة).
3. الطلاب **لا يتسجّل** دخولهم في `auth_logs` — النظام ده لفريق الإدارة فقط.

**التحقق:** type-check + مراجعة إن التسجيل مش بيعطّل مسار الدخول لو فشل.

---

## Milestone 4: تسجيل أفعال الكتابة في كل السيرفر أكشنز (Instrumentation)

**الهدف:** كل عملية كتابة في لوحة الأدمن تسجّل صف في `activity_logs`.

**دي أكبر milestone — نفّذها ملف-بملف وبصبر. لا تغيّر منطق أي أكشن، فقط أضف استدعاء `logActivity` بعد نجاح العملية (مش قبلها — سجّل الحقيقة اللي حصلت فعلاً).**

**قائمة الملفات والأفعال المطلوب تغطيتها (راجع كل ملف واكتشف دواله الفعلية):**

| الملف | المورد | أمثلة الأفعال المتوقعة |
|---|---|---|
| `app/admin/students/actions.ts` | students | إنشاء طالب (create)، حذف طالب (delete) |
| `app/admin/students/[id]/actions.ts` | students | تغيير حالة طالب (update)، إرسال رسالة/إشعار لطالب (create مع details) |
| `app/admin/courses/actions.ts` | courses | إضافة/تعديل/حذف محاضرة ودرس وواجب... (الملف كبير — غطِّ **كل** دوال الكتابة فيه) |
| `app/admin/categories/actions.ts` | categories | إضافة/تعديل/حذف تصنيف/مرحلة/فرع |
| `app/admin/exams/actions.ts` | exams | إنشاء/تعديل/حذف/نشر اختبار |
| `app/admin/exams/[id]/actions.ts` | exams | تصحيح submission (update مع details) |
| `app/admin/calendar/actions.ts` | calendar | إضافة/تعديل/حذف حدث |
| `app/admin/payments/orders-actions.ts` | payments | **قبول طلب = action `approve`، رفض = `reject`** (دي إجابة سؤال "مين قبل معاملة الطالب") — خزّن في `target_label` اسم الطالب ورقم/قيمة الطلب |
| `app/admin/messages/actions.ts` | messages | إرسال/حذف رسالة |
| `app/admin/notifications/actions.ts` | notifications | إرسال إشعار |
| `app/admin/coupons/actions.ts` | coupons | إنشاء/تعديل/حذف كوبون |
| `app/admin/reports/actions.ts` | reports | توليد تقرير (create) |
| `app/admin/settings/actions.ts` | settings | تعديل الإعدادات/محتوى الموقع (update) |
| `app/admin/settings/assistants-actions.ts` | settings | **إنشاء مساعد، تعديل صلاحيات مساعد، حذف مساعد** — مهمين جداً للحوكمة، خزّن اسم المساعد المتأثر في `target_label` |

**إرشادات التنفيذ:**
- افحص كل ملف الأول بـ Grep على `export async function` وحدّد أي دوال بتكتب (insert/update/delete/upsert أو admin client calls).
- استدعِ `logActivity` **بعد** التأكد من نجاح العملية وقبل الـ return/revalidate، بصيغة fire-and-forget أو مع await داخل try/catch — المهم ما يأثرش على النتيجة.
- `target_label` دايماً بالعربي ومقروء. `details` جملة قصيرة عند الحاجة فقط.
- متسجلش أفعال فاشلة أو مرفوضة من الـ guard.

**التحقق:** type-check شامل + مراجعة عيّنة من كل ملف إن الاستدعاء في المكان الصح.

---

## Milestone 5: صفحة المراقبة `/admin/activity` (UI)

**الهدف:** لوحة مراقبة كاملة للأدمن الكامل فقط.

**المطلوب:**

1. **Server actions** جديدة (مثلاً `app/admin/activity/actions.ts`):
   - `getActivityLogs(filters)` — مع فلاتر: actor معين، resource، action، نطاق تاريخ، pagination (حد معقول زي 50/صفحة). **guard: `requireAdmin` فقط** (مش hasResourceAccess — الصفحة دي للأدمن الكامل حصرياً حتى لو المساعد عنده settings).
   - `getAuthLogs(filters)` — نفس المنطق.
   - `getActivityStats()` — إحصائيات بسيطة: عدد أفعال اليوم، أنشط مساعد، آخر دخول لكل مساعد.
   - `getActorsList()` — قائمة الأدمن والمساعدين للفلتر.
2. **الصفحة** `app/admin/activity/page.tsx` + مكونات في `components/activity/`:
   - **تبويبان:** "سجل النشاط" و"سجل الدخول".
   - **Timeline/جدول** للأحداث: أيقونة ولون حسب نوع الفعل (أخضر create، أزرق update، أحمر delete، بنفسجي ممنوع — التزم بألوان الثيم الموجودة semantic tokens)، اسم الفاعل + دوره (badge "مساعد"/"أدمن")، الوصف، الهدف، الوقت النسبي بالعربي ("منذ ٥ دقائق").
   - **شريط فلاتر:** حسب الشخص / المورد / نوع الفعل / الفترة.
   - **كروت إحصائيات** أعلى الصفحة (أفعال اليوم، عدد المساعدين النشطين، آخر حدث).
   - **Pagination** أو زر "تحميل المزيد".
   - سجل الدخول: جدول فيه الشخص، الحدث، الـ IP، الجهاز (parse مبسّط للـ user agent: نظام + متصفح)، الوقت.
   - اتبع نفس أنماط UI الموجودة في المشروع (نفس الكروت والجداول والـ badges المستخدمة في باقي صفحات الأدمن، RTL بالعربي).
3. **زر "سجل هذا العنصر" (اختياري لو الوقت سمح):** في صفحة تفاصيل الطالب، قسم صغير يعرض آخر الأحداث اللي `target_id` بتاعها هو الطالب ده (نفس `getActivityLogs` بفلتر).

**التحقق:** type-check + معاينة الصفحة (هتظهر فاضية لأن الديف بيشتغل mock/بدون داتا — ده متوقع).

---

## Milestone 6: الربط الأمني والتنقل

**الهدف:** الصفحة تظهر وتتحمى صح.

**المطلوب:**

1. **Sidebar:** أضف عنصر "المراقبة" (أيقونة مناسبة زي Activity أو ShieldCheck من lucide) في `components/dashboard/sidebar.tsx`. **مشكلة تصميمية مهمة:** عناصر الـ sidebar حالياً بتتفلتر بـ `PermissionMap` حسب `resource` — وصفحة المراقبة **مش مورد للمساعدين، هي للأدمن الكامل فقط**. الحل المقترح: أضف خاصية `adminOnly: true` لعنصر الـ nav، وعدّل منطق الفلترة: لو `adminOnly` والمستخدم عنده permissions map (يعني مساعد) → إخفاء. الأدمن الكامل (permissions undefined) يشوفه عادي.
2. **Middleware** (`lib/supabase/proxy.ts`): المسار `/admin/activity` مش ضمن `RESOURCES` mapping — تأكد إن المساعد لو حاول يفتحه يتمنع. عدّل المنطق: أي مسار admin مش متمابّ لمورد => مسموح للأدمن الكامل فقط (المنطق الحالي بيرجّع `hasAccess = false` لو `resource = null` للمساعد — راجع وتأكد إن ده فعلاً بيحصل، ولو لأ صلّحه).
3. **Page-level guard:** في `app/admin/activity/page.tsx` نفسها تحقق من `requireAdmin` و redirect لو مش أدمن (دفاع مزدوج).
4. لو فيه أي مكان تاني بيعرض روابط أدمن (command palette مثلاً؟ ابحث) — طبّق نفس القاعدة.

**التحقق:** type-check + التأكد يدوياً من منطق الفلترة في الكود.

---

## Milestone 7: مراجعة نهائية وتسليم

1. **Type-check شامل** — صفر أخطاء في الملفات المتغيرة (فيه أخطاء pre-existing معروفة في: register route, event-form-modal, header asChild, exam-charts, student-welcome — متحاولش تصلحها، مش ضمن النطاق).
2. **مراجعة أمنية سريعة:**
   - مفيش مسار يسمح للمساعد يقرأ اللوجز (actions + middleware + sidebar + RLS).
   - الـ logger مش بيرمي أخطاء أبداً.
   - مفيش تسجيل لبيانات حساسة (باسوردات، توكنات) في `details` أو `target_label`.
3. **حدّث `docs/audit-system-plan.md`** (الملف ده): علّم على الـ milestones المكتملة.
4. **رسالة تسليم لصاحب المشروع** توضّح: إيه اللي خلص، وإن ملف `scripts/audit_system.sql` لازم يتشغّل يدوياً على الـ live DB قبل ما النظام يشتغل فعلياً، وإن الاختبار الحي مش ممكن من بيئة التطوير.

---

## خارج النطاق (لا تنفّذها إلا بطلب صريح لاحق)

- تخزين before/after diff للتعديلات.
- تسجيل القراءات (فتح صفحات/ملفات).
- تنبيهات فورية للأدمن عند فعل حساس.
- Undo/Rollback.
- تصدير CSV/PDF للسجل.
- سياسة retention/أرشفة للسجلات القديمة.
- كشف الجلسات المتزامنة/الشاذة.

---

## أسئلة محسومة مسبقاً (لا تسأل عنها تاني)

- الأدمن بيتراقب زي المساعد بالظبط — نعم.
- المساعد ما يشوفش أي جزء من السجل حتى نشاطه هو — نعم، مخفي تماماً.
- أفعال الطلاب (شراء، حل امتحان...) **لا تتسجّل** في النظام ده — ده نظام مراقبة فريق الإدارة فقط.
- اسم الصفحة في الـ sidebar: "المراقبة".
