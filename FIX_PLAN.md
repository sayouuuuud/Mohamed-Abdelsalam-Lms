# خطة إصلاح منصة LMS — مقسّمة إلى Milestones

> مكتوبة لموديل التنفيذ (Sonnet). كل milestone فيه: **السبب الجذري الحقيقي** (بعد تحقيق فعلي في الكود وقاعدة البيانات عبر Supabase MCP)، **الملفات المتأثرة**، و**خطوات مفصّلة**. نفّذ بالترتيب، وبعد كل milestone اعمل commit منفصل.

## قرارات صاحب المنصة (مؤكّدة)
- **#1 البحث:** صفحة بحث شاملة موحّدة.
- **#2 الاختبارات:** الاختبار المستهدَف بمرحلة يظهر لكل طلاب المرحلة مباشرةً عبر `students.stage_id`.
- **#6 الشعار:** اسم نصّي + رفع شعار يتحكّم فيهما الأدمن من محرّر المحتوى.
- **#8 و #9:** حذف قسم عرض الترم بالكامل من صفحة المرحلة العامة.

## حقائق قاعدة البيانات المؤكّدة (فحص فعلي)
- `profiles` **لا تحتوي** `stage_id` — فيها `grade` نصّي فقط.
- `students` **تحتوي** `stage_id` (uuid) ومضبوط فعلاً.
- `exams` فيها `stage_id` و `branch_id`. **كل الاختبارات الحالية `stage_id = null`** ومربوطة بـ `branch_id` فقط.
- لا يوجد `exam_attempts`؛ الموجود `exam_submissions`.
- `lessons.is_free` (boolean) مستقل تماماً عن `lectures.price`.
- Migration `add_terms_system` أضاف `terms`, `monthly_courses.term_id`, `order_items.term_id`, `cart_items.term_id`.

---

## Milestone 1 — إصلاح البحث في لوحة الإدارة (#1)

### السبب الجذري
`components/dashboard/header.tsx` → `handleSearch` يعمل `router.push` لصفحة مختلفة حسب المسار الحالي، والافتراضي يروح لصفحة الطلاب. لذلك البحث من صفحة المحاضرات/التصنيفات يحوّل لصفحة الطلاب. القرار: بناء صفحة بحث شاملة موحّدة.

### الملفات المتأثرة
- `components/dashboard/header.tsx` (تعديل `handleSearch`)
- `app/admin/search/page.tsx` (جديد)
- `app/admin/search/actions.ts` (جديد)
- `components/admin/search-results.tsx` (جديد)

### خطوات التنفيذ
1. `globalAdminSearch(q)` في `app/admin/search/actions.ts`: تحقّق صلاحية الأدمن (نمط `hasResourceAccess`)، ثم `Promise.all` باستعلامات `ilike` على: `students`/`profiles` (اسم/إيميل/هاتف)، `lectures.title`، `monthly_courses.title`، `exams.title`، `stages.title` + `branches.title`. أرجِع `{ students, lectures, courses, exams, categories }` بحد ~10 لكل نوع، كل عنصر معه `href`.
2. `app/admin/search/page.tsx`: server component يقرأ `await searchParams` (Next 16)، يستدعي الـ action، يمرّر لـ `SearchResults`.
3. `components/admin/search-results.tsx`: عرض بعناوين أقسام + روابط + حالة فارغة أنيقة.
4. عدّل `handleSearch`: دائماً `router.push('/admin/search?q=' + encodeURIComponent(query.trim()))`. احذف الـ branching حسب pathname. احترم IME (`isComposing`/`keyCode===229`).
5. تأكّد `/admin/search` محمي داخل `app/admin/layout.tsx`.

### القبول
البحث من أي صفحة أدمن يفتح `/admin/search?q=...` بنتائج من كل الأقسام، بدون تحويل قسري.

---

## Milestone 2 — ظهور الاختبارات حسب المرحلة (#2)

### السبب الجذري
`getStudentExams` في `app/student/actions.ts` يفلتر بـ `e.stage_id === stageId`، لكن كل الاختبارات `stage_id = null` (مربوطة بـ `branch_id`)، والطلاب معرّفون عبر `students.stage_id`. `saveExam` سليم (`stage_id: meta.stageId || null`) لكن الـ builder لا يمرّر `stageId`، والفلترة لا تعتمد على `students.stage_id` بثقة.

### الملفات المتأثرة
- `components/exams/builder/exam-builder.tsx`
- `app/admin/exams/actions.ts` (`saveExam`)
- `app/student/actions.ts` (`getStudentExams`)
- `lib/auth-guard.ts` (`getCurrentStudent`)

### خطوات التنفيذ
1. تأكّد `getCurrentStudent`/`getStudentTargeting` يرجّع `stageId` من `students.stage_id` (لا من `profiles.grade`).
2. في الـ builder: تأكّد وجود اختيار مرحلة يُرسَل ضمن `meta` إلى `saveExam`، وعدم إجبار `branchId`. `console.log("[v0] saveExam meta", meta)` مؤقتاً.
3. في `getStudentExams`: أظهر الاختبار لو تحقّق أي من: `exam.stage_id === student.stageId` (الأولوية) أو استهداف الفرع (توافق عكسي) أو استهداف عام. أزل أي شرط يمنع الظهور عند تطابق المرحلة.
4. الاختبارات القديمة `stage_id=null` تحتاج إعادة حفظ باختيار المرحلة؛ أو (اختياري عبر MCP) املأ `stage_id` من `branch→stage`.

### القبول
اختبار بمرحلة "أولى ثانوي" يظهر فوراً لكل طالب مرحلته أولى ثانوي بدون اشتراط شراء فرع.

---

## Milestone 3 — سؤال رفع الملف بالاختبار (#3)

### السبب الجذري
`question-card.tsx` نوع `file` يعرض `FileEditor` = إعدادات الأدمن (صحيح). واجهة رفع الطالب في `components/student/exams/exam-detail.tsx` (~468-490). يُرجَّح سوء فهم أو عدم ظهور/حفظ حقل الرفع في كل الحالات — تحقّق فعلي مطلوب.

### الملفات المتأثرة
- `components/exams/builder/question-card.tsx`
- `components/student/exams/exam-detail.tsx`
- `app/student/exams/actions.ts` (حفظ الإجابة)

### خطوات التنفيذ
1. أنشئ سؤال "رفع ملف" كأدمن واحفظ؛ تأكّد `question_type='file'` يُخزَّن.
2. كطالب: افتح الاختبار وتأكّد ظهور منطقة رفع فعلية؛ لو غائبة أضفها في `exam-detail.tsx` بنمط `uploadToStorageWithProgress` من `lib/storage-upload`.
3. تأكّد حفظ الملف في `exam_submissions` وظهوره للأدمن عند التصحيح.
4. تحقّق بالمتصفح للدورة كاملة.

### القبول
الطالب يرى زر رفع واضح، والملف يُحفَظ ويظهر للأدمن.

---

## Milestone 4 — مدة الفيديو والتشغيل (#4)

### السبب الجذري (طبقات)
- **الاستخراج:** `components/ui/video-upload-field.tsx` يقرأ المدة client-side ويستدعي `onDurationDetected`. يجب أن يحفظها نموذج الدرس في `lessons.duration`.
- **التشغيل:** `lib/student-lectures-data.ts` (~697-712): HLS عبر `/api/hls/...` (يتطلب اكتمال تحويل worker)، وإلا `/api/lectures/[lessonId]/stream` الذي يعمل `Response.redirect(video_url, 302)` لرابط تخزين خام.
- **الأرجح:** `VideoPlayer` فيه `crossOrigin="anonymous"`؛ مع 302 لأصل مختلف بدون رؤوس CORS → يفشل التحميل.

### الملفات المتأثرة
- `components/ui/video-upload-field.tsx`
- `components/courses/lecture-form-modals.tsx`
- `app/api/lectures/[lessonId]/stream/route.ts`
- `components/student/courses/video-player.tsx`
- `lib/student-lectures-data.ts`

### خطوات التنفيذ
1. **حفظ المدة:** في `lecture-form-modals.tsx` تأكّد تمرير `onDurationDetected={(d)=>setDuration(d)}` وإرسال `duration` ضمن payload إلى `lessons.duration`. `console.log` مؤقت.
2. **CORS/التشغيل:** جرّب MP4 قديم بالمتصفح. لو فشل CORS: إمّا أزل `crossOrigin` لـ MP4 العادي، أو حوّل `/stream` من redirect إلى **proxy same-origin** يدعم `Range` (runtime `nodejs` — انتبه لدرس `node:crypto` السابق الذي منع edge).
3. **HLS fallback:** لو `_videoId` موجود والتحويل غير مكتمل، اضمن fallback لـ MP4 حتى لا يعلق الطالب.
4. تحقّق بالمتصفح: رفع فيديو (تظهر المدة) ثم تشغيله كطالب.

### القبول
المدة تظهر وتُحفَظ تلقائياً، والفيديو يشتغل عند الطالب.

---

## Milestone 5 — سعر المحاضرة "مجانية" خطأً (#5)

### السبب الجذري
شارة "مجاني" في `components/courses/lectures-grid.tsx` تعتمد `lesson.isFree` من `lessons.is_free` (في `lib/curriculum.ts` ~146). هذه علامة "معاينة مجانية" على مستوى الدرس، منفصلة عن `lectures.price`.

### الملفات المتأثرة
- `lib/curriculum.ts`
- `components/courses/lectures-grid.tsx`
- `components/stages/*` (أي شارة سعر)

### خطوات التنفيذ
1. المحاضرة مجانية **فقط إذا `lecture.price === 0`** (أو null). اجعل الشارة تعتمد على `price` حصراً.
2. أبقِ `lesson.is_free` لمعناه الصحيح (درس معاينة داخل محاضرة مدفوعة) فقط.
3. راجع `lectures-grid.tsx` (~184، 251، 256) وبدّل شرط `isFree` المبني على الدرس إلى `price` المحاضرة.
4. تأكّد التناسق في `components/stages/*`.

### القبول
سعر > 0 → "مدفوعة" دائماً؛ سعر 0 فقط → "مجانية".

---

## Milestone 6 — اسم/شعار صفحة الدخول من الإدارة (#6)

### السبب الجذري
"عبد السلام" hardcoded في `app/auth/page.tsx` (~60، ~108). `login_panel` في `lib/site-content-defaults.ts` فيه `badge/headline/perks/stats` فقط — بدون `brandName`/`logoUrl`.

### الملفات المتأثرة
- `lib/site-content-defaults.ts`
- `lib/site-content.ts`
- `components/settings/site-content-tab.tsx`
- `app/auth/page.tsx`
- (اختياري) `components/dashboard/header.tsx` / navbar

### خطوات التنفيذ
1. أضف `brandName: string` و`logoUrl: string` لنوع `LoginPanelContent` + defaults (`brandName:'عبد السلام'`, `logoUrl:''`).
2. في `site-content-tab.tsx` قسم `login_panel`: أضف Field للاسم (Input) وField لرفع الشعار (استخدم مكوّن رفع الصور الموجود، ابحث `ImageUploadField`).
3. في `app/auth/page.tsx`: اقرأ `panel.brandName`/`panel.logoUrl` واعرضهما بدل النص الثابت. أزل "عبد السلام".
4. تأكّد `getSiteContent()` يرجّع الحقول الجديدة (JSON — لا تغيير DB).

### القبول
تغيير الاسم/الشعار من المحرّر ينعكس فوراً على صفحة الدخول بدون كود.

---

## Milestone 7 — حذف عرض الترم (#8+#9) وإصلاح 404 المحرّر (#7)

### السبب الجذري
- **#8/#9:** `components/stages/stage-detail.tsx` يعرض "Full term banner" للزوّار. القرار: حذف كامل.
- **#7:** محرّر `stage_offer` في `site-content-tab.tsx` يؤدي 404؛ وبحذف القسم من الواجهة يصبح المحرّر بلا هدف. إزالته تُنهي 404.

### الملفات المتأثرة
- `components/stages/stage-detail.tsx`
- `components/settings/site-content-tab.tsx` (إزالة `stage_offer` من `sections` ~1040-1045 وحالته)
- `lib/site-content-defaults.ts` / `lib/site-content.ts` (اترك الـ type لتفادي كسر البيانات، أزل من UI فقط)

### خطوات التنفيذ
1. في `stage-detail.tsx`: احذف كامل `<section>` الخاص بـ "Full term banner" (`offer.*`, `stage.terms`/`termPrice`, `SubscribeButton`).
2. أزل الاستخدام أولاً ثم الـ imports غير المستخدمة (`SubscribeButton`، أيقونات البانر).
3. في `site-content-tab.tsx`: أزل عنصر `stage_offer` من `sections`، و`useState` الخاص بـ `stageOffer`، و`case 'stage_offer'` في `reset`.
4. لا تحذف `stage_offer` من DB ولا من الـ types الأساسية (تفادي كسر `getSiteContent` مع بيانات قديمة).
5. تحقّق: `/stages/sec-1` كزائر (القسم اختفى)، والمحرّر (لا رابط 404).

### القبول
لا قسم عرض ترم للزوّار، ولا رابط 404 في محرّر المحتوى.

---

## Milestone 8 — مراجعة نهائية وتحقق بالمتصفح
1. راجع كل روابط الأدمن/الطالب لمنع 404 جديدة.
2. تأكّد `/admin/search` وأي صفحة جديدة محمية بحارس الأدمن.
3. تحقّق بالمتصفح (agent-browser): بحث الأدمن، اختبار بالمرحلة، رفع ملف بالاختبار، فيديو+مدة، شارة السعر، اسم/شعار الدخول، اختفاء عرض الترم.
4. احذف كل `console.log("[v0] ...")`.
5. build نظيف بلا أخطاء أنواع.

### ملاحظات للمنفّذ
- تعديلات DB (إن لزمت) عبر Supabase MCP لا عبر ملفات migration محلية.
- عند الإزالة: الاستخدام أولاً ثم الـ import.
- استخدم Edit/Write لا bash.
- بعد كل milestone: commit منفصل + `Co-authored-by: v0 <it+v0agent@vercel.com>`.
