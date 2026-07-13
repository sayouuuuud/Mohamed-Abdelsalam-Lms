# خطة تطوير الكورسات + حساب الطالب + الإعدادات (تنفيذ Sonnet)

> خطة تنفيذ مقسّمة لـ milestones. نفّذ مرحلة مرحلة بالترتيب. كل مرحلة فيها: الملفات بمساراتها الحقيقية، الخطوات، معايير القبول، وGotchas.
> **لا تبدأ مرحلة قبل ما تخلّص اللي قبلها وتتأكد إنها بتكمبايل.**

---

## القواعد الذهبية (اقرأها قبل أي مرحلة)

1. **الهرمية والمصطلحات (مهم جداً):**
   - `stages` = **المرحلة** (سنة دراسية) → `branches` = **الفرع** → `monthly_courses` = **الكورس** → بداخله `monthly_course_sections` = **التصنيف/القسم** + `lectures` = **المحاضرة** → `lessons` = **الدرس** (وعليه الفيديو).
   - يعني: الفيديو الفعلي بيتحط على مستوى **الدرس (lesson)**، والمحاضرة (lecture) بتجمّع دروس، والتصنيف (section) بيجمّع محاضرات جوا الكورس.

2. **الأعمدة الموجودة بالفعل في الـ DB (متأكد منها — استخدمها ولا تعمل أعمدة جديدة إلا لو المرحلة قالت):**
   - `monthly_courses.is_published` (boolean) → **للمسودة**. منشور = ظاهر، مسودة = مخفي.
   - `monthly_courses.price` (numeric) → للسعر.
   - `lectures.is_free` (boolean) → المحاضرة المجانية.
   - `lessons.video_url` (text, nullable) → **رابط الفيديو**. هنستخدمه لرابط يوتيوب.
   - `lessons.video_id` → معرّف فيديو الـ HLS الحالي.

3. **الكورس المجاني:** متاح للعامة حتى **بدون تسجيل دخول**. مفيش أعمدة جديدة مطلوبة — الكورس المجاني = `price = 0`. لما `price = 0` كل محاضرات الكورس تتفتح لأي حد.

4. **فيديو اليوتيوب:** مجرد **embed** لمشغّل يوتيوب (iframe). **بدون أي streaming/transcoding**. خيار بديل لكل درس: يا إما فيديو HLS مرفوع، يا إما رابط يوتيوب. اللي متحط هو اللي يشتغل.

5. **ممنوع تكسر الموجود:** نظام الـ HLS/transcoder شغّال. أي درس بفيديو HLS لازم يفضل يشتغل زي ما هو. اليوتيوب إضافة مش استبدال.

6. **الأمان:** أي استعلام بيرجّع كورس مسودة (`is_published = false`) لازم يتفلتر من الصفحات العامة وصفحات الطلاب. المسودة تظهر في الأدمن فقط.

7. **بعد كل مرحلة:** شغّل `pnpm exec tsc --noEmit` وتأكد إن مفيش أخطاء جديدة قبل ما تكمّل.

---

## الملفات المحورية (خريطة سريعة)

**الأدمن:**
- `app/admin/courses/page.tsx` — صفحة المحاضرات (فيها تابات)، بتلفّ `CurriculumProvider` + `CurriculumFormModals`.
- `components/courses/courses-lectures-tabs.tsx` — التابات (تاب الكورسات + تاب المحاضرات).
- `components/categories/curriculum-context.tsx` — الحالة المشتركة (فتح مودالات الإنشاء/التعديل).
- `components/categories/curriculum-form-modals.tsx` — مودالات إنشاء/تعديل المرحلة/الفرع/الكورس.
- `app/admin/categories/actions.ts` — الـ server actions (createCourse/updateCourse...).
- `components/categories/courses-grid.tsx` — طريقة عرض الكورسات (grid) في التصنيفات — مرجع للتصميم.
- `components/courses/admin-lecture-detail.tsx` — تفاصيل المحاضرة في الأدمن (مكان إسناد فيديو الدرس).
- `components/ui/video-upload-field.tsx` — حقل رفع الفيديو.

**الطالب:**
- `components/student/student-sidebar.tsx` — قائمة تنقّل الطالب (تصفح المحاضرات / كورساتي).
- `app/student/browse/page.tsx` + `components/student/browse/student-browse-page.tsx` — صفحة التصفّح.
- `app/student/courses/page.tsx` — صفحة كورساتي.
- `components/student/courses/video-player.tsx` + `lesson-player.tsx` — المشغّل.
- `lib/student-lectures-data.ts` — جلب بيانات محاضرات الطالب + حل مصدر الفيديو.

**الإعدادات + الاستريمنج:**
- `components/dashboard/sidebar.tsx` — سايدبار الأدمن (فيه لينك الاستريمنج + لينك التصنيفات).
- `app/admin/streaming/page.tsx` — صفحة إعدادات الاستريمنج الحالية.
- `app/admin/settings/page.tsx` + `components/settings/settings-panel.tsx` — الإعدادات (تابات).
- `components/dashboard/page-header.tsx` / `header.tsx` — أزرار الداشبورد.

**الأنواع:**
- `lib/landing-data.ts` — أنواع `Stage/Branch/MonthlyCourse/CourseSection/Lecture/Lesson`.
- `lib/curriculum.ts` — الأنواع + دوال الجلب.

---

## M0 — تجهيز الأنواع + دوال الحالة (أساس لكل الباقي)

**الهدف:** نضمن إن `is_published` و`price` و`video_url`(يوتيوب) موجودين في الأنواع والاستعلامات قبل ما نبني UI.

**الخطوات:**
1. في `lib/landing-data.ts` (أو `lib/curriculum.ts` حسب مكان النوع): تأكد إن نوع `MonthlyCourse` فيه:
   - `isPublished: boolean`
   - `price: number`
   - ولو مش موجودين، ضيفهم واملأهم من الـ DB في دالة الـ mapping.
2. تأكد إن نوع `Lesson` فيه `videoUrl: string | null` (لرابط يوتيوب) بالإضافة لـ `videoId`.
3. في `lib/curriculum.ts`: دوال الجلب العامة (`getCurriculum`, `getStageBySlug`, `getBranchBySlug`, `getCourseBySlug`) لازم:
   - **تفلتر الكورسات المسودة** (`is_published = false`) — متظهرش في الصفحات العامة.
   - أضف باراميتر اختياري `includeUnpublished = false` عشان الأدمن يقدر يجيب الكل.

**معايير القبول:**
- `tsc --noEmit` نظيف.
- استعلام عام (بدون `includeUnpublished`) مايرجّعش أي كورس `is_published=false`.

**Gotchas:**
- متعملش أعمدة DB جديدة — كلها موجودة. لو محتاج تتأكد استخدم أداة Supabase `execute_sql` بـ `information_schema.columns`.
- لو النوع بيتبني من صف DB، خلي الـ mapping يقرأ `row.is_published ?? true` عشان الكورسات القديمة اللي قيمتها null تفضل ظاهرة.

---

## M1 — تاب الكورسات في الأدمن: عرض grid + إنشاء من نفس الصفحة

**الهدف:** (طلب #1) تحسين عرض الكورسات لـ grid، وإتاحة إنشاء كورس من نفس الصفحة، وتعديل زر الداشبورد.

**الملفات:** `components/courses/courses-lectures-tabs.tsx`, `components/categories/curriculum-context.tsx`, `components/categories/courses-grid.tsx` (مرجع), `components/dashboard/page-header.tsx` أو `sidebar.tsx`/`header.tsx` (زر الداشبورد).

**الخطوات:**
1. في تاب الكورسات داخل `courses-lectures-tabs.tsx`:
   - غيّر عرض الكورسات لـ **grid** responsive: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`. استعن بشكل الكروت في `components/categories/courses-grid.tsx`.
   - كل كارت يعرض: صورة/أيقونة الكورس، العنوان، الفرع/المرحلة التابع لها، السعر (أو "مجاني" لو 0)، وبادج حالة (منشور/مسودة — هيتفعّل في M3).
2. **زر "إنشاء كورس جديد"** أعلى التاب:
   - استخدم `useCurriculum()` من `curriculum-context.tsx` لفتح مودال إنشاء الكورس مباشرة (`openCreateCourse` أو ما يعادله). الصفحة `app/admin/courses/page.tsx` بالفعل بتلفّ `CurriculumProvider` + `CurriculumFormModals` فالمودال متاح.
   - لو مفيش دالة `openCreateCourse` في الكونتكست، ضيفها بنفس نمط الدوال الموجودة.
3. **زر الداشبورد:** دوّر على الزر اللي بيوجّه لإنشاء الكورس (في `components/dashboard/page-header.tsx` أو `header.tsx` أو `sidebar.tsx` — اللينك الحالي على الأرجح `/admin/categories`). غيّر الـ `href` لـ `/admin/courses` (صفحة المحاضرات/الكورسات).

**معايير القبول:**
- تاب الكورسات بيعرض الكورسات في grid منسّق.
- زر "إنشاء كورس جديد" بيفتح مودال الإنشاء **من نفس الصفحة** بدون تنقّل.
- إنشاء كورس جديد بينجح ويظهر في الـ grid فوراً (revalidate/refresh).
- زر الداشبورد بيوجّه لـ `/admin/courses`.

**Gotchas:**
- لو `CurriculumFormModals` محتاج `stageId`/`branchId` عشان يعرف الكورس بيتعمل تحت مين، خلي المودال يطلب اختيار المرحلة والفرع من dropdowns (البيانات موجودة في الكونتكست).
- بعد الإنشاء نادِ `router.refresh()` أو الـ revalidate الموجود في الـ action.

---

## M2 — خيار "كورس مجاني بالكامل"

**الهدف:** (طلب #2) خيار في نموذج الكورس يخليه مجاني، والمجاني يتفتح للعامة حتى بدون تسجيل.

**الملفات:** `components/categories/curriculum-form-modals.tsx`, `app/admin/categories/actions.ts`, ومنطق فتح المحاضرات (`lib/student-lectures-data.ts` + `lib/curriculum.ts` + صفحات الكورس/المشاهدة).

**الخطوات:**
1. في مودال إنشاء/تعديل الكورس (`curriculum-form-modals.tsx`): أضف **Switch/Checkbox** "كورس مجاني بالكامل".
   - لما يتفعّل: يخفي حقل السعر (أو يعطّله) ويثبّت `price = 0`.
   - لما يتلغّى: يظهر حقل السعر عادي.
2. في `actions.ts` (`createCourse`/`updateCourse`): تأكد إن `price = 0` بيتخزّن صح.
3. **منطق الوصول (الأهم):** أي مكان بيتحقق هل الطالب يقدر يفتح محاضرة/درس لازم يعتبر الكورس مجاني لو `course.price === 0`:
   - في `lib/student-lectures-data.ts` وأي guard في صفحات المشاهدة: لو `price === 0` → الوصول مسموح **للجميع** (زائر أو طالب) بدون تحقق شراء.
   - صفحة المشاهدة العامة (`app/stages/.../watch/...` أو ما يعادلها) لازم تسمح بعرض كل دروس الكورس المجاني بدون auth.
4. في كروت الكورس (الأدمن + العامة + الطالب): اعرض بادج "مجاني" لما `price === 0`.

**معايير القبول:**
- تفعيل "مجاني" في المودال → الكورس يتخزّن بـ `price=0`.
- زائر **غير مسجّل** يقدر يفتح ويشغّل كل محاضرات الكورس المجاني.
- الكورس المدفوع يفضل مقفول زي ما هو.

**Gotchas:**
- خلي بالك من الفرق بين "الكورس مجاني" (كل الكورس) و`lectures.is_free` (محاضرة مفردة مجانية). الاتنين موجودين — المجاني على مستوى الكورس أوسع.
- لو فيه middleware بيحمي مسارات `/student` أو `/watch`، تأكد إن مسار مشاهدة الكورس المجاني مستثنى أو بيتعامل مع الزائر.

---

## M3 — خيار "مسودة" للكورس (is_published)

**الهدف:** (طلب #3) خيار يخلي الكورس مسودة (مخفي) أو منشور.

**الملفات:** `components/categories/curriculum-form-modals.tsx`, `app/admin/categories/actions.ts`, `components/courses/courses-lectures-tabs.tsx` (بادج الحالة), ودوال الجلب في `lib/curriculum.ts` (فلترة — اتعملت في M0).

**الخطوات:**
1. في مودال الكورس: أضف **Switch** "منشور / مسودة" مربوط بـ `isPublished`. الافتراضي للكورس الجديد = مسودة (`false`) عشان صاحب المنصة يجهّزه الأول — أو منشور لو تفضّل، لكن **الافتراضي مسودة أأمن**.
2. في `actions.ts`: خزّن `is_published` في `createCourse`/`updateCourse`.
3. في تاب الكورسات بالأدمن: بادج واضح لكل كارت — "منشور" (أخضر) / "مسودة" (رمادي/أصفر). ويفضّل زر سريع للتبديل (toggle) من الكارت نفسه.
4. تأكد (من M0) إن الصفحات العامة وصفحات الطلاب بتفلتر المسودة. الأدمن بس يشوف المسودات.

**معايير القبول:**
- كورس مسودة **مايظهرش** في: الصفحة الرئيسية، صفحات المراحل/الفروع، تصفّح الطالب، sitemap.
- كورس مسودة يظهر في تاب الكورسات بالأدمن ببادج "مسودة".
- تبديل الحالة من الأدمن بيشتغل ويتحدّث فوراً.

**Gotchas:**
- **مهم:** راجع `app/sitemap.ts` — لازم يفلتر الكورسات المسودة (استخدم دالة الجلب العامة اللي بتفلتر، مش استعلام خام).
- راجع `getCourseBySlug` المستخدمة في صفحة الكورس العامة — لو حد فتح لينك كورس مسودة مباشرة لازم يرجّع 404 (`notFound()`).

---

## M4 — إعادة تسمية عناصر حساب الطالب

**الهدف:** (طلب #4) "تصفح المحاضرات" → "تصفح الكورسات"، و"كورساتي" → "محاضراتي".

**الملفات:** `components/student/student-sidebar.tsx` (النصوص)، وأي مكان تاني فيه نفس التسميات (page titles، breadcrumbs، `page-header`، metadata).

**الخطوات:**
1. في `student-sidebar.tsx`: 
   - "تصفح المحاضرات" → **"تصفح الكورسات"**.
   - "كورساتي" → **"محاضراتي"**.
2. دوّر بـ grep على النصين في كل المشروع (عناوين الصفحات، `<h1>`, metadata title في `app/student/browse/page.tsx` و`app/student/courses/page.tsx`) وغيّرهم للاتساق.
3. **مهم:** غيّر **النص المعروض فقط**، مش المسارات (`/student/browse`, `/student/courses`) ولا أسماء الملفات/المتغيرات — عشان متكسرش لينكات.

**معايير القبول:**
- السايدبار والعناوين بتعرض "تصفح الكورسات" و"محاضراتي".
- كل اللينكات لسه شغّالة (المسارات ما اتغيّرتش).

**Gotchas:**
- ابحث عن التسميات القديمة في: `student-sidebar.tsx`, `app/student/browse/page.tsx`, `app/student/courses/page.tsx`, وأي `page-header`/metadata. لا تفوّت الـ `<title>`/metadata.

---

## M5 — تصفّح الكورسات: تصنيفات collapse + محاضرات جوّاها + المجاني يشتغل

**الهدف:** (طلب #5) في صفحة تصفّح الطالب، الكورس بيظهر بس من غير ما تبان تقسيمة التصنيفات جوّاه. المطلوب: كل تصنيف (section) يبقى **collapsible**، ولما أعمل expand أشوف المحاضرات اللي جوّاه، والمحاضرات المجانية تظهر وأقدر أفتحها.

**الملفات:** `components/student/browse/student-browse-page.tsx`, `lib/student-lectures-data.ts` (تأكد إنها بترجّع الـ sections + lectures + is_free), `components/student/courses/*`.

**الخطوات:**
1. تأكد إن مصدر البيانات بيرجّع الكورس **مع تصنيفاته (sections) وكل تصنيف مع محاضراته (lectures)** وحالة `isFree` لكل محاضرة. لو `student-lectures-data.ts` مش بيرجّع الـ sections، وسّع الاستعلام.
2. في `student-browse-page.tsx`: 
   - اعرض الكورس، وتحته قائمة **التصنيفات (sections)** كـ Accordion/Collapsible (استخدم `@/components/ui/accordion` أو `collapsible` من shadcn الموجود).
   - كل تصنيف مقفول افتراضياً؛ عند الـ expand يظهر المحاضرات اللي جوّاه.
   - كل محاضرة: العنوان + بادج "مجانية" لو `isFree` أو الكورس `price===0` + زر فتح/تشغيل.
3. **المحاضرات المجانية:** 
   - لازم تظهر وتكون قابلة للفتح حتى لو الطالب مش مشترك في الكورس.
   - المحاضرة تُعتبر مفتوحة لو: الكورس `price===0` **أو** `lecture.isFree===true` **أو** الطالب مشترك/مشتري.
   - اربط زر الفتح بمشغّل المحاضرة الموجود (نفس اللي بتستخدمه `lesson-player`/`video-player`).

**معايير القبول:**
- كل كورس في التصفّح بيبان تحته تصنيفاته كـ collapse مقفول.
- expand التصنيف → تظهر محاضراته.
- محاضرة مجانية (أو كورس مجاني) → بادج "مجانية" وتتفتح وتشتغل فعلياً حتى بدون اشتراك.
- محاضرة مدفوعة غير متاحة → مقفولة (قفل/CTA اشتراك).

**Gotchas:**
- تأكد إن الـ Accordion جوّا كارت الكورس مش بيكسر الـ layout؛ استخدم مكوّن shadcn الموجود بدل ما تعمل واحد من الصفر.
- خلي بالك من الأداء لو الكورسات كتير — الـ Collapsible بيأجّل عرض المحتوى، تمام. لو البيانات ثقيلة اجلبها مرة واحدة على مستوى الصفحة.
- اختبر بحساب طالب **غير مشترك** وبزائر — المجاني لازم يشتغل.

---

## M6 — فيديو يوتيوب للدرس + تهيئة المشغّل (طلب #6 — مهم جداً)

**الهدف:** إمكانية إضافة فيديو للدرس عن طريق **رابط يوتيوب**، والمشغّل في الموقع يعرض فيديو اليوتيوب (embed، بدون streaming).

**الملفات:** `components/courses/admin-lecture-detail.tsx` (إسناد الفيديو للدرس), `components/ui/video-upload-field.tsx`, `app/admin/categories/actions.ts` أو أكشن الدروس, `lib/student-lectures-data.ts` (حل المصدر), `components/student/courses/video-player.tsx` + `lesson-player.tsx`, `components/stages/free-lecture-watch.tsx`.

**الخطوات:**
1. **الأدمن — إدخال الرابط:** في مكان إسناد فيديو الدرس (`admin-lecture-detail.tsx` / `video-upload-field.tsx`):
   - أضف تبديل بين مصدرين: **"رفع فيديو (HLS)"** و**"رابط يوتيوب"**.
   - في وضع اليوتيوب: حقل إدخال URL. خزّن الرابط في `lessons.video_url`.
   - اعمل helper `extractYouTubeId(url)` يدعم الصيغ: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`, `youtube.com/shorts/`. لو الرابط غير صالح اعرض خطأ.
2. **حل المصدر:** في `lib/student-lectures-data.ts` (وأي مكان بيبني `src` للمشغّل): 
   - لو `lesson.videoUrl` فيه يوتيوب → النوع `"youtube"` + `youtubeId`.
   - غير كده → النوع `"hls"` بالمنطق الحالي (token/stream).
   - رجّع للمشغّل كائن زي `{ kind: 'youtube' | 'hls', youtubeId?, src? }`.
3. **المشغّل:** في `video-player.tsx`/`lesson-player.tsx`:
   - لو `kind === 'youtube'`: اعرض `<iframe>` يوتيوب:
     `https://www.youtube-nocookie.com/embed/{id}?rel=0&modestbranding=1` مع `allowFullScreen` و`allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"`. غلّفه بحاوية `aspect-video w-full`.
   - لو `kind === 'hls'`: سيب المنطق الحالي زي ما هو **بدون أي تغيير**.
   - طبّق نفس المنطق في `free-lecture-watch.tsx` (مشاهدة المحاضرة المجانية) عشان المجاني باليوتيوب يشتغل.

**معايير القبول:**
- الأدمن يقدر يختار "رابط يوتيوب" لأي درس ويحفظه.
- الدرس اللي عليه يوتيوب بيشتغل في المشغّل عبر iframe يوتيوب (صوت وصورة).
- الدروس القديمة بفيديو HLS تفضل تشتغل زي ما هي.
- الدرس المجاني باليوتيوب يشتغل للزائر.

**Gotchas:**
- **لا تعمل transcoding أو streaming لليوتيوب** — مجرد embed.
- `aspect-video` ضروري عشان المشغّل ما يبقاش مشوّه.
- لو الموقع فيه CSP (`next.config`/headers)، تأكد إن `frame-src`/`child-src` بيسمح بـ `https://www.youtube-nocookie.com` و`https://www.youtube.com`. لو الـ iframe مبيظهرش، دي أول حاجة تتفحص.
- متكسرش نوع `Lesson` — `videoUrl` نصّي موجود بالفعل، بس خزّن فيه رابط اليوتيوب كامل، والاستخراج وقت العرض.

---

## M7 — نقل إعدادات الاستريمنج جوّا الإعدادات

**الهدف:** (طلب #7) شيل لينك إعدادات الفيديو/الاستريمنج من السايدبار، وحطّه كتاب/قسم جوّا صفحة الإعدادات.

**الملفات:** `components/dashboard/sidebar.tsx`, `app/admin/streaming/page.tsx`, `app/admin/settings/page.tsx`, `components/settings/settings-panel.tsx`.

**الخطوات:**
1. في `settings-panel.tsx`: أضف **تاب جديد "الفيديو / الاستريمنج"**، وانقل محتوى `app/admin/streaming/page.tsx` (الفورم/المكوّنات) جوّاه كمكوّن.
   - يفضّل تستخرج محتوى صفحة الاستريمنج لمكوّن `components/settings/streaming-tab.tsx` وتستخدمه في التاب.
2. في `sidebar.tsx`: **شيل** عنصر لينك الاستريمنج من قائمة التنقّل.
3. `app/admin/streaming/page.tsx`: 
   - إما اعمله redirect لـ `/admin/settings?tab=streaming`، أو شيله خالص لو مفيش حاجة بتلينك ليه. **الأأمن:** خلّيه redirect عشان أي bookmark قديم مايكسرش.
4. تأكد إن الـ server actions/بيانات إعدادات الاستريمنج لسه شغّالة من مكانها الجديد (نفس الـ actions، بس UI اتنقل).

**معايير القبول:**
- مفيش لينك استريمنج في السايدبار.
- صفحة الإعدادات فيها تاب "الفيديو/الاستريمنج" بكل الإعدادات شغّالة (حفظ/تحميل).
- فتح `/admin/streaming` القديم بيوجّه للإعدادات (مايكسرش).

**Gotchas:**
- لو إعدادات الاستريمنج بتعتمد على `"use client"` state أو fetch، انقلها بالكامل (hooks + actions) مش بس الـ JSX.
- تأكد إن التاب الجديد متوافق مع نمط باقي التابات في `settings-panel.tsx` (نفس الـ Field/Save button pattern).

---

## قائمة تحقق نهائية (بعد كل المراحل)

- [ ] `pnpm exec tsc --noEmit` نظيف.
- [ ] تاب الكورسات grid + إنشاء كورس من نفس الصفحة + زر الداشبورد بيوجّه صح.
- [ ] كورس مجاني (price=0) يتفتح للزائر بدون تسجيل.
- [ ] كورس مسودة مخفي من كل الصفحات العامة + الطلاب + sitemap، وظاهر في الأدمن ببادج.
- [ ] السايدبار: "تصفح الكورسات" + "محاضراتي".
- [ ] تصفّح الطالب: تصنيفات collapse، expand يظهر المحاضرات، المجانية تشتغل.
- [ ] درس بيوتيوب يشتغل (embed) + درس HLS قديم لسه شغّال.
- [ ] إعدادات الاستريمنج جوّا الإعدادات + السايدبار نضيف + redirect للقديم.
- [ ] اختبار في المتصفح بحساب طالب غير مشترك + زائر للتأكد من المجاني واليوتيوب.
