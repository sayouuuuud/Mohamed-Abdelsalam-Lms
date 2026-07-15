# خطة تنفيذية مفصّلة — إعادة هيكلة تخزين الميديا (R2 للفيديو + UploadThing للصور)

> **الجمهور المستهدف:** موديل التنفيذ (Sonnet).
> **الأسلوب:** نفّذ Milestone تلو الآخر بالترتيب. لا تبدأ Milestone جديد قبل استيفاء "معايير القبول" للـ Milestone السابق.
> **لغة الكود:** التعليقات بالعربي مسموحة (متسقة مع الكودبيس)، أسماء الدوال/الملفات بالإنجليزي.

---

## 0) خلاصة الوضع الحالي (تم التحقق منها فعلياً — لا تفترض غير ذلك)

| البند | الحقيقة المؤكَّدة |
|------|------------------|
| متغيرات R2 | **غير موجودة إطلاقاً** في البيئة. فقط `UPLOADTHING_TOKEN` مضبوط. `isR2Configured()` ترجع `false`. |
| جدول `videos` / `video_jobs` | **فارغ تماماً (0 صف)**. خط تحويل HLS لم يُشغَّل قط. |
| الفيديوهات الحالية | 38 درس لهم `video_url`: 1 يوتيوب، 2 على Supabase Storage، **35 على `commondatastorage.googleapis.com` (عيّنات BigBuckBunny)**. |
| الصور الحالية | معظمها مسارات ثابتة داخل `public/` (مثل `/lectures/mechanics.png`). صورتان فقط مرفوعتان على `*.supabase.co`. **لا توجد صورة واحدة على UploadThing.** |
| UploadThing | مستخدم فقط لـ: مرفقات الدروس (`lessonAttachment`) وإيصالات الدفع (`receiptUploader`). endpoints معرّفة في `app/api/uploadthing/core.ts`: `receiptUploader`, `curriculumImage`, `lessonVideo`, `lessonAttachment`. |
| رفع الصور حالياً | `components/ui/image-upload-field.tsx` → `lib/storage-upload.ts` → **Supabase Storage bucket `media`** (وليس UploadThing كما يظن المالك). |
| رفع الفيديو حالياً | `components/ui/video-upload-field.tsx` فيه وضعان: `streamingEnabled` (R2) ووضع legacy (Supabase Storage). بما أن R2 غير مهيّأ، النظام يستخدم legacy دائماً. |
| ربط المشغّل | `lib/student-lectures-data.ts::getPurchasedLesson` يبني `/api/hls/{lessonId}/master.m3u8?t=` لو `lessons.video_id` موجود، وإلا `/api/lectures/{lessonId}/stream?t=`. المشغّل `components/student/courses/lesson-player.tsx` يمرّر `lesson.videoUrl` لـ `VideoPlayer`. **الربط سليم** — لكن لأن `videos` فارغ، دائماً يسقط على `/stream`. |
| الحذف | `deleteLesson/deleteLecture` في `app/admin/courses/actions.ts` و `deleteBranch/deleteStage/deleteMonthlyCourse` في `app/admin/categories/actions.ts` كلها `.delete()` على الصف فقط — **صفر تنظيف للميديا**. |
| `next.config.mjs` | `images.unoptimized = true` ولا يوجد `remotePatterns`. |

### الأهداف المطلوبة من المالك (حرفياً)
1. **الفيديو على R2، الصور على UploadThing "كلها"** — لتقليل عدد الطلبات على R2.
2. **أداة هجرة حساب UploadThing:** زرّان في تبويب جديد بصفحة إعدادات الأدمن — زر يسحب كل الصور/الملفات من الحساب القديم ببياناتها، وبعد تبديل الحساب زر يرفعها للحساب الجديد بنفس البيانات بدون كسر الموقع.
3. **ربط R2 بدون أخطاء.**
4. **حذف الميديا فعلياً عند حذف محاضرة/درس** (صور + فيديو + مرفقات).
5. **مراجعة وإصلاح الاستريمينج/تقطيع الفيديو.**

---

## Milestone M0 — تهيئة R2 والتحقق من الاتصال بدون أخطاء

**الهدف:** جعل R2 مضبوطاً وقابلاً للاستخدام من المتصفح (presigned PUT) والسيرفر، مع أداة تشخيص واضحة.

### الخطوات
1. **طلب متغيرات البيئة من المالك** عبر `SystemAction(requestEnvironmentVariables)`:
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` (اختياري — يُشتق من ACCOUNT_ID).
   - لا تكتب أي كود يعتمد على القيم قبل تأكيد إدخالها.
2. **CORS على R2 bucket:** الرفع المباشر من المتصفح (presigned PUT في `video-upload-field.tsx`) يتطلب CORS. وثّق الضبط اليدوي في `services/transcoder/README.md`:
   ```json
   [{ "AllowedOrigins": ["https://<domain>", "http://localhost:3000"],
      "AllowedMethods": ["GET","PUT","HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600 }]
   ```
3. **زر تشخيص R2** داخل تبويب "الفيديو والـ Streaming" (`components/settings/streaming-tab.tsx`):
   - Server action جديد في `lib/video-actions.ts`: `testR2Connection()` يقوم بـ `PutObject` لملف `healthcheck/ping.txt` ثم `HeadObject` ثم `DeleteObject`، ويرجع `{ ok, latencyMs, error? }`.
   - يعرض النتيجة (نجاح/فشل + الرسالة) في الـ UI.

### معايير القبول
- `isR2Configured()` ترجع `true`.
- زر التشخيص يرجع `ok: true` مع زمن استجابة.
- لا أخطاء TypeScript.

---

## Milestone M1 — تحويل رفع الصور بالكامل إلى UploadThing

**الهدف:** كل رفع صورة جديد يذهب لـ UploadThing بدل Supabase Storage، مع تجهيز الصور القديمة للنقل في M3.

> ملاحظة: الفيديو يبقى على R2 (M4). الصور والمرفقات على UploadThing.

### الخطوات
1. **تحويل `components/ui/image-upload-field.tsx`** من `uploadToStorage` إلى `useUploadThing('curriculumImage', {...})` (الراوت موجود). حافظ على نفس الواجهة (`value/onChange/label/hint`) وأضف progress + معالجة أخطاء بنفس نمط `toast`.
2. **الأفاتار في الإعدادات:** `components/settings/settings-panel.tsx::handleAvatarFile` يستخدم `uploadToStorage(file,'images')` → حوّله لنفس مسار UploadThing (استخدم `curriculumImage` أو أضف endpoint `avatarImage` في الـ core).
3. **حصر كل مستخدمي `uploadToStorage(..., 'images')`** (`grep -rn "uploadToStorage" app components`) وحوّل استخدامات الصور فقط. (مسار الفيديو legacy `uploadToStorageWithProgress(...,'videos')` يُعالَج في M4.)
4. **`remotePatterns`:** أضف احتياطياً في `next.config.mjs` `images.remotePatterns` لـ `**.ufs.sh`, `utfs.io`, `**.supabase.co` تحسباً لتفعيل الأوبتمة مستقبلاً.
5. **الصورتان على Supabase:** ستُعالَجان ضمن أداة الهجرة في M3 (تشمل كل الأصول). سجّل الاعتماد.

### معايير القبول
- رفع صورة من محرر المناهج/المحاضرة/الدرس/الأفاتار ينتج رابط `*.ufs.sh` أو `utfs.io`.
- لا استخدام متبقٍّ لـ `uploadToStorage` لأغراض الصور.
- الصور القديمة (public + supabase) تظل تُعرض بلا كسر.

---

## Milestone M2 — حذف الميديا فعلياً عند الحذف (Cascade Cleanup)

**الهدف:** عند حذف أي كيان، تُحذف ملفاته من المزوّد الصحيح (R2 للفيديو، UploadThing للصور/المرفقات، Supabase للقديم).

### 2.1 helper مركزي جديد: `lib/media-cleanup.ts` (server-only)
```ts
function utKeyFromUrl(url: string): string | null            // يدعم utfs.io/f/<key> و <appId>.ufs.sh/f/<key>
async function deleteUploadThingUrls(urls: string[]): Promise<void>   // import { UTApi } from 'uploadthing/server'
async function deleteVideoAssets(videoId: string): Promise<void>     // raw/{id}.* + hls/{id}/** + صفوف videos/video_jobs
async function deleteSupabaseStorageUrls(urls: string[]): Promise<void> // bucket 'media' حسب المسار المستخرج
async function deleteMediaByUrl(urls: (string|null|undefined)[]): Promise<void> // موزّع يحدد المزوّد من الرابط
```
- أضف في `lib/r2.ts`: `listR2Objects(prefix)` (`ListObjectsV2Command`) و `deleteR2Objects(keys[])` (`DeleteObjectsCommand`، دفعات ≤1000).
- كل الحذف **best-effort** (لا يُفشل حذف الصف لو فشل حذف ملف) مع `console.log('[media-cleanup] ...')`.

### 2.2 ترتيب الجمع قبل الحذف (مهم)
لأن FK قد يكون `ON DELETE CASCADE`:
```
1. اقرأ الكيان + أبناءه واجمع كل الروابط/المفاتيح (صور + video_id + attachments).
2. احذف صف الكيان من DB.
3. استدعِ deleteMediaByUrl/deleteVideoAssets للمجموعة (بعد نجاح حذف DB).
```
> تحقق فعلياً عبر Supabase MCP من قواعد الـ FK (`ON DELETE CASCADE`) بين lectures→lessons وbranches→...→lessons لتحديد عمق الجمع.

### 2.3 التعديلات على دوال الحذف
- `deleteLesson`: اقرأ `video_url, video_id, attachments` → `deleteVideoAssets(video_id)` + `deleteMediaByUrl([video_url, ...attachmentUrls])`.
- `deleteLecture`: `lectures.image` + كل `lessons` التابعة (video_id/video_url/attachments).
- `deleteBranch`/`deleteStage`/`deleteMonthlyCourse`: صور الكيان + جمع الشجرة الفرعية (وثّق العمق).
- **استبدال/إزالة الفيديو من المحرر:** أضف server action `discardVideo(videoId)` يحذف أصول R2 والصف قبل إعادة الرفع (تجنّب أصول يتيمة)، واربطه بزر "حذف وإعادة الرفع" في `video-upload-field.tsx`.

### معايير القبول
- حذف درس فيه فيديو R2 يحذف `raw/` و `hls/` والصفوف.
- حذف درس فيه مرفقات UploadThing يحذفها من الحساب.
- حذف محاضرة/فرع/مرحلة يحذف صورها.
- فشل حذف ملف لا يمنع حذف الصف (best-effort + لوج).

---

## Milestone M3 — أداة هجرة حساب UploadThing (زرّان في تبويب جديد)

**الهدف:** قبل تبديل حساب UploadThing، "لقطة" لكل الأصول من الحساب القديم؛ وبعد التبديل، إعادة رفعها للحساب الجديد وإعادة كتابة كل الروابط في DB.

### 3.1 حصر مصادر روابط UploadThing في DB
- `lessons.attachments` (jsonb array `{name,url,type}`), `lessons.video_url` (لو أي legacy على UT).
- صور المناهج بعد M1: `stages.image`, `branches.image`, `monthly_courses.image`, `lectures.image`.
- إيصالات الدفع: حدّد العمود الفعلي (`grep receiptUploader|receipt` + تحقق DB).
- الأفاتار لو انتقل لـ UT: `admins.avatar_url`/`profiles.avatar_url` (تحقق من الأسماء).
> **إلزامي:** قبل كتابة كود الحصر، شغّل استعلامات تعداد فعلية (Supabase MCP) لتأكيد أسماء الجداول/الأعمدة.

### 3.2 مخطط DB — جدول لقطة الهجرة (عبر migration)
```sql
create table if not exists media_migration_assets (
  id uuid primary key default gen_random_uuid(),
  old_url text not null,
  old_key text,
  file_name text,
  content_type text,
  size_bytes bigint,
  source_table text not null,
  source_column text not null,
  source_row_id text not null,
  json_index int,
  stage_path text,
  new_url text,
  new_key text,
  status text not null default 'pending',  -- pending|downloaded|uploaded|remapped|error|skipped
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on media_migration_assets(status);
create unique index on media_migration_assets(old_url, source_table, source_column, source_row_id, json_index);
```
- **تخزين البايتات المؤقت:** خزّنها في Supabase Storage bucket `migration-cache/` (متاح، لمرة واحدة). وثّق الاختيار. (بديل: R2 تحت `migration-cache/`.)

### 3.3 Server actions — `app/admin/settings/migration-actions.ts`
```ts
export async function exportUploadThingAssets(): Promise<{ total, downloaded, errors }>
//  يمسح DB → يبني صفوف اللقطة (idempotent عبر unique index) → fetch(old_url) → رفع للـ migration-cache → status='downloaded'.
export async function importUploadThingAssets(): Promise<{ total, uploaded, remapped, errors }>
//  لكل downloaded/error: اقرأ البايتات → UTApi.uploadFiles(new File([bytes], file_name,{type})) بالحساب الجديد
//  → أعد كتابة المرجع (نصي: update col=new_url ; jsonb: بدّل attachments[json_index].url) → status='remapped'. idempotent.
export async function getMigrationStatus(): Promise<{ counts, lastRunAt }>
export async function clearMigrationCache(): Promise<...>
```
- **أمان:** كل الدوال تتحقق أن المستخدم full admin.
- **الحدود/الاستئناف:** عالج على دفعات (≈10 ملفات/استدعاء) لتجنّب timeout، مع إمكانية استئناف عبر الحالة. وثّق.
- **UTApi:** `import { UTApi } from 'uploadthing/server'`؛ `uploadFiles` تستخدم `UPLOADTHING_TOKEN` وقت التشغيل (الحساب الجديد بعد التبديل).

### 3.4 UI — تبويب جديد
- أضف تبويب `{ id: 'migration', label: 'نقل الملفات', icon: FolderSync }` في `baseTabs` بـ `components/settings/settings-panel.tsx`، مقيّد بـ `isFullAdmin`.
- أنشئ `components/settings/migration-tab.tsx`:
  - بطاقة شرح الخطوات (1: اسحب من القديم → 2: بدّل التوكن في Vercel → 3: ادفع للجديد).
  - زر "سحب من الحساب القديم" → `exportUploadThingAssets` + عدّادات.
  - زر "رفع للحساب الجديد" → `importUploadThingAssets` (معطّل حتى يكتمل السحب).
  - جدول حالة (إجمالي/تنزيل/رفع/ربط/أخطاء) + زر تحديث + زر تنظيف الكاش.
  - تحذير: "لا تبدّل التوكن قبل اكتمال السحب".

### معايير القبول
- "سحب" ينشئ اللقطة ويخزّن البايتات بعدّادات صحيحة.
- بعد تبديل التوكن، "رفع" يعيد الرفع ويحدّث كل الروابط في DB.
- كل روابط الموقع تُشير للحساب الجديد؛ لا كسر.
- idempotent وقابل للاستئناف.

---

## Milestone M4 — إصلاح ومراجعة الاستريمينج/التقطيع (End-to-End)

**الهدف:** تشغيل خط R2→FFmpeg→HLS فعلياً من الرفع حتى التشغيل.

### 4.1 نشر/تفعيل الـ transcoder worker (السبب الجذري)
- الكود جاهز في `services/transcoder` لكنه **غير منشور** و`WORKER_WAKE_URL` غير مضبوط → لا jobs تُعالَج.
  1. وثّق النشر (Railway/Fly/Render) في README مع: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `R2_*`, `WORKER_MODE`, `WORKER_WAKE_SECRET`, `PORT`.
  2. اطلب من المالك ضبط `WORKER_WAKE_URL` + `WORKER_WAKE_SECRET` في Vercel.
  3. **إصلاح تعارض هيدر التصحية:** `server.ts` يتحقق من `Authorization: Bearer <secret>` بينما `confirmVideoUpload` (في `lib/video-actions.ts`) يرسل `x-wake-secret`. وحّدهما على `Authorization: Bearer`.
  4. fallback: بدون `WORKER_WAKE_URL`، شغّل الخدمة بوضع `poll`.

### 4.2 توصيل الإعدادات بالـ FFmpeg
- `services/transcoder/src/db.ts::getStreamingConfig` يتجاهل `segment_duration_sec` وrenditions ثابتة.
  - مرّر `segment_duration_sec` إلى `ffmpeg.ts` بدل `hls_time` الثابت (=4).
  - (اختياري) أضف عمود `renditions` لـ `platform_settings` أو أبقِ الافتراضي مع تعليق.
- `ffmpeg.ts::writeMasterManifest`: أضف سمة `CODECS` (`avc1.4d401f,mp4a.40.2`) لتحسين التوافق.

### 4.3 التحقق من مسارات HLS (مراجعة فقط — تبدو صحيحة)
- الـ worker يرفع `hls/{videoId}/master.m3u8` + `{rendition}/index.m3u8` + `seg%05d.ts`.
- `app/api/hls/[lessonId]/[...path]/route.ts` يعيد كتابة الروابط النسبية ويحقن التوكن ويوقّع الـ segments (302). تأكد أن `r2_hls_prefix` (`hls/{videoId}/`) يطابق ما يرفعه الـ worker.

### 4.4 اختبار end-to-end
- بعد تفعيل R2، ارفع فيديو حقيقياً من محرر الدرس (`streamingEnabled=true`) وتحقق: pending→processing→ready، ثم شغّله كطالب مالك → يبني `/api/hls/...` ويعمل.
- الـ 35 عيّنة تبقى تعمل عبر `/stream` (MP4 fallback).

### 4.5 المشغّل (تم إصلاحه — تحقق فقط)
- `video-player.tsx` يدعم hls.js + `retryKey` + استعادة NETWORK/MEDIA. تأكد من بقائه سليماً.

### معايير القبول
- رفع فيديو ينشئ صفوف `videos`+`video_jobs` ويُعالَج حتى `ready`.
- طالب مالك يشغّل HLS بنجاح مع تبديل الجودات.
- segments تمر عبر البوابة الموقّعة.
- حذف الدرس (M2) يحذف أصول HLS من R2.

---

## Milestone M5 — تحقق شامل وضبط نهائي (QA)
1. **TypeScript/Build:** `pnpm exec tsc --noEmit` نظيف؛ `pnpm build` ينجح.
2. **متصفح (agent-browser، viewport 697x630 light):** رفع صورة (UT)، رفع فيديو (R2→ready)، تشغيل درس (HLS/MP4/يوتيوب)، حذف درس/محاضرة (تأكد اختفاء الملفات)، تبويب النقل (سحب ثم رفع).
3. **أمان:** كل server actions الجديدة تتحقق من صلاحية الأدمن.
4. **تنظيف:** إزالة أي `console.log('[v0] ...')` مؤقتة.
5. **توثيق:** حدّث `services/transcoder/README.md` و`.env.example`.
6. **Commit + PR** على `v0/sayouuuuud-8042-d10a4a95` (لا تدفع على main).

---

## ملاحظات تنفيذية عامة (اقرأها قبل البدء)
- **لا تفترض schema** — تحقق عبر Supabase MCP قبل أي كود يعتمد على أسماء جداول/أعمدة (خصوصاً الإيصالات والأفاتار في M3، وقواعد FK في M2).
- **best-effort للحذف:** لا تُفشل عملية DB بسبب فشل حذف ملف.
- **idempotency** في أدوات الهجرة إلزامية.
- **الترتيب الموصى به:** M0 → M1 → M2 → M4 → M3 → M5.
- **المتغيرات الناقصة:** اطلبها عبر `SystemAction` واستخدم `isR2Configured()` كبوابة؛ لا تفشل صامتاً.
- **عدّل فقط الملفات اللازمة**، واتبع نمط الكود القائم.
