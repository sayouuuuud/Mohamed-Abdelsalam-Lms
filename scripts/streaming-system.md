# خطة تنفيذ نظام Streaming ذاتي (R2 + FFmpeg + HLS)

> **وثيقة تنفيذ تفصيلية موجّهة للمنفّذ (AI/مطوّر).**
> اقرأها بالكامل قبل ما تكتب أي سطر. كل Milestone مستقلة وليها معايير قبول واضحة.
> اللغة: عربي، والمصطلحات + أسماء الملفات/الدوال بالإنجليزي عشان تطابق الكود حرفيًا.

---

## 0. قواعد ذهبية للمنفّذ (اقرأها أولًا — مخالفتها تكسر النظام)

1. **الـ live DB هي المصدر الحقيقي.** أي تعديل DB يتكتب في ملف SQL داخل `scripts/` ويشغّله المستخدم يدويًا. **ممنوع منعًا باتًا** تعديل DB عبر Supabase MCP (المتصل بـ DB قديمة).
2. **سيرفر التطوير يعمل بـ mock data بدون DB فعلي**، والوركر خارجي. يعني **لا يوجد اختبار حي** لفلو الرفع/التشغيل داخل v0. الاختبار = بناء + `tsc --noEmit` + مراجعة منطق. التأكيد النهائي بعد ما المستخدم يشغّل SQL + ينشر الوركر + يضبط env.
3. **ممنوع حذف أي feature.** نظام `/api/lectures/[lessonId]/stream` القديم يبقى شغّال كـ **fallback** دائم.
4. **التوافق العكسي إجباري.** الفيديوهات القديمة في `lessons.video_url` (على Supabase Storage bucket `media`) لازم تفضل تشتغل بالظبط زي دلوقتي.
5. **قبل تعديل أي ملف، اقرأه بالكامل بأداة Read.** التواقيع في الوثيقة دي مرجعية، بس الكود ممكن يكون اتغيّر — تأكّد.
6. **رتّب التنفيذ بالمراحل.** لا تبدأ Milestone قبل ما تخلّص اللي قبلها وتعدّي معايير القبول، إلا لو الوثيقة قالت إنها مستقلة.
7. **السر المستخدم للتوقيع HMAC هو `SUPABASE_SERVICE_ROLE_KEY`** (نفس المستخدم في `lib/video-token.ts`). لا تغيّره ولا تخترع سر جديد.
8. **الترميز العربي في الروابط:** المشروع بيستخدم slugs عربية. أي param في الراوت لازم يتعامل معاه بـ `decodeURIComponent` (زي اللي اتعمل في صفحات الكورس).

---

## 1. ملخّص تنفيذي

استبدال تشغيل الـ MP4 الواحد بنظام **HLS adaptive streaming** مبني ذاتيًا:

- **التخزين:** Cloudflare R2 (S3-compatible، egress مجاني).
- **المعالجة (transcoding):** worker منفصل فيه FFmpeg (خارج Vercel).
- **التوصيل:** هجين — بوابة أمن تتحقق من الملكية/التوكن وتوقّع روابط، والـ segments تُجلب مباشرة من R2.
- **تحكّم أدمن:** تفعيل/إيقاف الاستريمنج، threads/concurrency للـ FFmpeg، الجودات.
- **بدون watermark.**

---

## 2. الوضع الحالي (خريطة دقيقة بعد الفحص)

### 2.1 الرفع (الأدمن)
- `components/courses/admin-lesson-detail.tsx` (مودال تعديل الدرس) يستخدم:
  - `const [video, setVideo] = useState(lesson.videoUrl ?? '')`
  - `<VideoUploadField value={video} onChange={setVideo} hint="..." />`
  - عند الحفظ: `payload = { ..., videoUrl: video || null, ... }`
  - المعاينة: `<VideoPlayer key={lesson.videoUrl} src={lesson.videoUrl} poster={...} />`
- `components/ui/video-upload-field.tsx`:
  - Props: `{ value: string; onChange: (url: string) => void; label?: string; hint?: string }`
  - المنطق: `handleFile` → `uploadToStorage(file, 'videos')` → `onChange(url)`.
- `lib/storage-upload.ts`:
  - `uploadToStorage(file: File, folder: 'images'|'videos'|'attachments'): Promise<string>`
  - يرفع إلى Supabase Storage bucket **`media` (عام)** ويرجّع `publicUrl`.

### 2.2 التشغيل (الطالب)
- `lib/student-lectures-data.ts` (~سطر 656):
  ```ts
  if (lesson.type === 'فيديو' && lesson.lessonId) {
    const token = await createPlaybackToken(user.id, lesson.lessonId)
    lesson.videoUrl = `/api/lectures/${lesson.lessonId}/stream?t=${encodeURIComponent(token)}`
  }
  ```
  وقبلها بيمسح كل `videoUrl` من باقي الدروس (تسريب صفر).
- `app/api/lectures/[lessonId]/stream/route.ts` (`runtime='nodejs'`, `dynamic='force-dynamic'`):
  - `verifyVideoToken(token)` + تطابق `payload.lessonId === lessonId`.
  - `supabase.auth.getUser()` + `user.id === payload.userId`.
  - `isLatestSession(user.id, lessonId, payload.sid)`.
  - يجيب `lessons.video_url, lecture_id` → `ownsLecture(admin, userId, lectureId)` (يفحص `orders.status='approved'` + `order_items.lecture_id`).
  - proxy بـ byte-range على `video_url`.
- `lib/video-token.ts`:
  - `signVideoToken(payload)`, `verifyVideoToken(token)`, `createPlaybackToken(userId, lessonId): Promise<string>`, `isLatestSession(userId, lessonId, sid): Promise<boolean>`.
  - `VideoTokenPayload = { lessonId, userId, sid, exp }`. `TOKEN_TTL_SECONDS = 3*60*60`. `SECRET = SUPABASE_SERVICE_ROLE_KEY`.
  - يستخدم جدول `lecture_playback_sessions` (upsert onConflict `user_id,lesson_id`).
- `components/student/courses/video-player.tsx`:
  - Props: `{ src?: string; poster?: string; className?: string }`.
  - `<video>` فيه `<source src={src} type="video/mp4" />` + أزرار مخصّصة (تشغيل/كتم/سرعة/ملء شاشة) + حماية (`controlsList`, `disablePictureInPicture`, `onContextMenu preventDefault`).
  - العنصر `dir="ltr"`.

### 2.3 جدول `lessons` الحقيقي (من live DB — تأكّد منه)
```
id, lecture_id, slug, title, duration, is_free, sort_order,
created_at, video_url, description, content_type, attachments (jsonb)
```

### 2.4 السايدبار
- `components/dashboard/sidebar.tsx`: مصفوفة `navItems` من نوع
  `{ label, icon: typeof LayoutDashboard, href, resource: ResourceKey, badge?, adminOnly? }`.
- آخر عنصرين: «سجل المراقبة» (`resource:'settings'`, `adminOnly:true`) و«الإعدادات» (`/admin/settings`, `resource:'settings'`).
- الأيقونات من `lucide-react`.

### 2.5 مشاكل الوضع الحالي
1. MP4 واحد → لا adaptive bitrate ولا transcoding.
2. bucket `media` **عام** → `video_url` قابل للفتح المباشر (التفاف حول البروكسي) = ثغرة.
3. كل بايت فيديو يمرّ عبر Vercel function → تكلفة + حدود مدة.

---

## 3. المعمارية المستهدفة (رسم مرجعي)

```
[الأدمن] → presigned PUT → R2: raw/{videoId}.{ext}
      └→ ينشئ videos row + video_jobs(queued) → (اختياري) يوقظ الوركر (HTTP)

[Worker + FFmpeg]  (Railway/Fly/VPS/Cloud Run)
  claim job → download raw → ffprobe → FFmpeg HLS ladder
  → upload hls/{videoId}/(master.m3u8 + variants + segments) → R2
  → videos.status='ready' (+duration/renditions) → webhook للمنصة

[الطالب] يفتح الدرس → المنصة: تحقق ملكية/جلسة → token
  → /api/hls/{lessonId}/master.m3u8?t=...  (بوابة الأمن)
       - تتحقق (نفس منطق stream القديم)
       - تجيب المانيفست من R2 وتعيد كتابة روابط الـ segments لـ presigned R2 (TTL=عمر التوكن)
  → hls.js يجلب الـ segments مباشرة من R2
```

**مبدأ الهجين:** المانيفستات (صغيرة) تمرّ عبر البوابة؛ الـ segments (ضخمة) تُجلب مباشرة من R2 → الباندويث على R2 مش على السيرفر.

**ليه الوركر منفصل؟** FFmpeg تقيل وطويل (CPU/RAM/قرص). Vercel serverless بيموت بعد ثواني ومفيهوش ffmpeg مستقر. فالمعالجة لازم على سيرفر دائم، ويفضّل scale-to-zero (ينام لما فاضي = مبيتكلّفش).

---

## MILESTONE M0 — التحضير والبنية التحتية (بدون كود منطقي)

**الهدف:** تجهيز التبعيات ومتغيرات البيئة قبل أي كود.

**الخطوات:**
1. طلب env vars للمنصة عبر `SystemAction(requestEnvironmentVariables)`:
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
   - `WORKER_WAKE_URL` (اختياري), `WORKER_WAKE_SECRET` (اختياري)
   - **ملاحظة:** `SUPABASE_SERVICE_ROLE_KEY` و`SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` موجودين بالفعل.
2. تثبيت تبعيات المنصة (Bash **قبل** كتابة أي import):
   ```
   pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner hls.js
   ```
   > `R2_ENDPOINT` الشكل: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`

**معايير القبول:** التبعيات مثبّتة في `package.json`، والـ env vars مطلوبة من المستخدم. **لا تفترض** إنها موجودة — الكود لازم يتعامل مع غيابها بلطف (رسالة خطأ واضحة مش crash).

**Gotchas:**
- متغيرات env في أوامر Bash **مش** متاحة تلقائيًا؛ استخدم `--env-file-if-exists=/vercel/share/.env.project` لو احتجت.
- R2 مش تكامل v0؛ المستخدم بيوفّر المفاتيح يدويًا.

---

## MILESTONE M1 — تغييرات قاعدة البيانات (ملف SQL فقط)

**الهدف:** ملف `scripts/streaming_system.sql` كامل، Idempotent، يشغّله المستخدم على live DB.

**الملف الجديد:** `scripts/streaming_system.sql`

**المحتوى المطلوب (بالترتيب):**

1. **جدول `videos`:**
   ```sql
   create table if not exists public.videos (
     id                uuid primary key default gen_random_uuid(),
     lesson_id         uuid references public.lessons(id) on delete set null,
     r2_raw_key        text,                 -- raw/{id}.{ext}
     r2_hls_prefix     text,                 -- hls/{id}/
     original_ext      text,
     status            text not null default 'uploaded'
                       check (status in ('uploaded','queued','processing','ready','error')),
     streaming         boolean not null default true,
     duration_seconds  integer,
     width             integer,
     height            integer,
     renditions        jsonb not null default '[]'::jsonb,
     progress          integer not null default 0,
     error_message     text,
     created_by        uuid,
     created_at        timestamptz not null default now(),
     updated_at        timestamptz not null default now()
   );
   ```

2. **جدول `video_jobs`:**
   ```sql
   create table if not exists public.video_jobs (
     id           uuid primary key default gen_random_uuid(),
     video_id     uuid not null references public.videos(id) on delete cascade,
     status       text not null default 'queued'
                  check (status in ('queued','processing','done','error')),
     attempts     integer not null default 0,
     max_attempts integer not null default 3,
     worker_id    text,
     claimed_at   timestamptz,
     error        text,
     created_at   timestamptz not null default now(),
     updated_at   timestamptz not null default now()
   );
   create index if not exists video_jobs_status_idx on public.video_jobs (status, created_at);
   ```

3. **جدول `streaming_settings` (singleton):**
   ```sql
   create table if not exists public.streaming_settings (
     id                  boolean primary key default true check (id),
     streaming_enabled   boolean not null default true,
     ffmpeg_threads      integer not null default 2,
     max_concurrent_jobs integer not null default 1,
     renditions          text[] not null default '{360p,480p,720p}',
     segment_seconds     integer not null default 6,
     updated_at          timestamptz not null default now()
   );
   insert into public.streaming_settings (id) values (true) on conflict (id) do nothing;
   ```

4. **ربط الدرس:**
   ```sql
   alter table public.lessons add column if not exists video_id uuid references public.videos(id);
   ```

5. **دالة claim آمنة:**
   ```sql
   create or replace function public.claim_video_job(p_worker text)
   returns public.video_jobs language plpgsql as $$
   declare j public.video_jobs;
   begin
     select * into j from public.video_jobs
       where status='queued' and attempts < max_attempts
       order by created_at for update skip locked limit 1;
     if not found then return null; end if;
     update public.video_jobs
       set status='processing', worker_id=p_worker, claimed_at=now(),
           attempts=attempts+1, updated_at=now()
       where id=j.id returning * into j;
     return j;
   end $$;
   ```

6. **RLS:** فعّل RLS على الجداول الثلاثة. السياسات: منع كل شيء افتراضيًا (الوصول التشغيلي عبر service role الذي يتخطّى RLS). أضف policy قراءة للأدمن لو لزم للوحة التحكم (أو اجعل اللوحة تقرأ عبر server action بـ admin client).
   ```sql
   alter table public.videos enable row level security;
   alter table public.video_jobs enable row level security;
   alter table public.streaming_settings enable row level security;
   ```

**معايير القبول:** الملف Idempotent (يتشغّل أكتر من مرة بدون خطأ)، وكل `references` تطابق أسماء الجداول الحقيقية (`lessons.id`). **لا تشغّله بنفسك** — بس اكتبه واطلب من المستخدم تشغيله.

**Gotchas:**
- `gen_random_uuid()` متاحة في Postgres الحديث (pgcrypto/pg13+) — Supabase بيدعمها.
- `renditions` في `videos` هي `jsonb` (تفاصيل)، لكن في `streaming_settings` هي `text[]` (اختيار بسيط). لا تخلط بينهم.

---

## MILESTONE M2 — عميل R2 (طبقة التخزين)

**الهدف:** ملف `lib/r2.ts` يوفّر presigned URLs وعمليات R2.

**الملف الجديد:** `lib/r2.ts` (server-only)

**العقد (الدوال المطلوبة):**
```ts
import 'server-only'
// عميل S3 موجّه لـ R2: { region:'auto', endpoint: R2_ENDPOINT, credentials:{...} }

export function r2Configured(): boolean        // true لو كل env vars موجودة
export function getR2Client(): S3Client         // throws لو مش مضبوط
export async function presignPutUrl(key: string, contentType: string, ttl?: number): Promise<string>
export async function presignGetUrl(key: string, ttl?: number): Promise<string>
export async function getObjectText(key: string): Promise<string>   // لقراءة المانيفست
export const R2_BUCKET: string
```

**الخطوات:**
1. اقرأ env؛ لو ناقص، `r2Configured()` يرجّع false والدوال التانية تعمل `throw new Error('R2 not configured')`.
2. `presignGetUrl` الافتراضي TTL = `3*60*60` (نفس عمر التوكن) عشان روابط الـ segments تعيش طول الجلسة.

**معايير القبول:** `tsc` نظيف، والملف server-only، ومفيش أي مفتاح بيتسرّب للعميل.

**Gotchas:**
- R2 محتاج `region:'auto'`.
- لا تستخدم `getObjectText` للـ segments (ضخمة) — بس للمانيفستات (`.m3u8`).

---

## MILESTONE M3 — مسار الرفع المباشر إلى R2 (الأدمن)

**الهدف:** الأدمن يرفع الفيديو مباشرة إلى R2 (يتخطى السيرفر)، مع إنشاء `videos` + `video_jobs`.

**ملفات جديدة:**
- `app/admin/courses/video-actions.ts` (server actions):
  ```ts
  'use server'
  // كلها تتحقق من صلاحية الأدمن أولًا (استخدم نفس نمط التحقق في actions.ts الحالي)
  export async function requestVideoUpload(input: { ext: string; contentType: string }):
    Promise<{ videoId: string; uploadUrl: string; key: string }>
  export async function finalizeVideoUpload(input: { videoId: string; streaming: boolean }):
    Promise<{ ok: boolean }>   // status→queued + ينشئ video_jobs + (اختياري) يوقظ الوركر؛ لو streaming=false يخلي status='ready' كـ MP4 مباشر
  export async function getVideoStatus(videoId: string):
    Promise<{ status: string; progress: number; error: string | null }>
  ```

**ملفات معدّلة:**
- `components/ui/video-upload-field.tsx`:
  - أضف props اختيارية **بدون كسر التواقيع الحالية**:
    `onVideoId?: (videoId: string | null) => void`, `streamingDefault?: boolean`.
  - غيّر `handleFile`: بدل `uploadToStorage` → `requestVideoUpload` → `PUT` مباشر إلى `uploadUrl` (استخدم `XMLHttpRequest` عشان `progress` bar حقيقي) → `finalizeVideoUpload` → `getVideoStatus` polling كل ~3s حتى `ready`/`error`.
  - **مهم للتوافق:** لسه يستدعي `onChange` بقيمة تشير للفيديو الجديد. القرار: `onChange` تستقبل قيمة فارغة والـ `onVideoId` تحمل الربط الفعلي، **أو** خلي `onChange('r2:'+videoId)` كـ sentinel. اختر واحدة ووثّقها، وعدّل `admin-lesson-detail.tsx` بناءً عليها.
  - أضف checkbox «تفعيل الاستريمنج لهذا الفيديو» (افتراضه = الإعداد العام؛ لو مقفول → MP4 مباشر).
  - أضف UI لحالة المعالجة: `queued → processing (progress%) → ready/error`.
- `components/courses/admin-lesson-detail.tsx`:
  - أضف state `videoId` بجانب `video`.
  - مرّر `videoId` في الـ payload (`videoId` جديد) عند الحفظ.
- `app/admin/courses/actions.ts`:
  - `createLesson`/`updateLesson` (و`LessonInput`) تقبل `videoId?: string | null` وتكتبها في `lessons.video_id`.
  - **نمط الأمان (retry):** لو عمود `video_id` لسه مش موجود (المستخدم ماشغّلش SQL)، اعمل retry بدون العمود — زي نمط `is_free`/`monthly_course_section_id` الموجود في نفس الملف.

**معايير القبول:** الرفع يشتغل منطقيًا (لا يمكن اختباره حيًا)، `tsc` نظيف، والتوافق العكسي محفوظ (لو streaming مقفول، سلوك MP4 القديم يعمل).

**Gotchas:**
- الرفع المباشر لـ R2 محتاج **CORS** على الـ bucket يسمح بـ PUT من الـ origin. وثّق ده في README (مسؤولية المستخدم على Cloudflare).
- لا تستخدم `fetch` للـ progress bar (مبيدعمش upload progress بسهولة) — استخدم `XMLHttpRequest`.
- **لا تحذف** `uploadToStorage` ولا مسار Supabase Storage — لسه مستخدم للصور والمرفقات.

---

## MILESTONE M4 — بوابة الأمن للـ HLS + دمج التشغيل

**الهدف:** راوت `/api/hls/...` يخدم المانيفست بأمان ويوقّع روابط الـ segments، والمشغّل يستخدم HLS.

**ملف جديد:** `app/api/hls/[lessonId]/[...path]/route.ts` (`runtime='nodejs'`, `dynamic='force-dynamic'`)

**المنطق (أعد استخدام منطق `stream/route.ts` حرفيًا):**
1. اقرأ `token = searchParams.get('t')` و`path = params.path` (مصفوفة).
2. `verifyVideoToken` + `payload.lessonId === lessonId`.
3. `supabase.auth.getUser()` + `user.id === payload.userId`. **استثناء:** لو الدرس `is_free` → تجاوز فحص الجلسة/الملكية (زي `free-lecture-data.ts`).
4. `isLatestSession`.
5. `admin.from('lessons').select('video_id, lecture_id, is_free')` → لو مش free: `ownsLecture(admin, userId, lecture_id)`.
6. `admin.from('videos').select('r2_hls_prefix, status').eq('id', video_id)` → لازم `status='ready'`.
7. حدّد نوع الطلب حسب امتداد آخر جزء في `path`:
   - **`.m3u8`:** `getObjectText(prefix + path)` → لكل سطر مش تعليق (`#`) و**مش** رابط مطلق: لو variant playlist (`.m3u8`) أعِد كتابته لرابط بوابة `/api/hls/{lessonId}/<subpath>?t=<token>`؛ لو segment (`.ts`/`.m4s`) أعِد كتابته لـ `presignGetUrl(prefix + seg, ttl)`. أرجِع النص بـ `content-type: application/vnd.apple.mpegurl` و`cache-control: private, no-store`.
   - **`.ts`/`.m4s`/أي segment:** `return Response.redirect(await presignGetUrl(prefix+path, ttl), 302)`. (الباندويث على R2.)
8. أي فشل تحقق → `new Response(null, { status: 401/403/404 })`.

**ملفات معدّلة:**
- `lib/student-lectures-data.ts` (~سطر 656): بعد جلب الدرس، **لو** فيه `video_id` وحالته `ready`:
  ```ts
  lesson.videoUrl = `/api/hls/${lesson.lessonId}/master.m3u8?t=${encodeURIComponent(token)}`
  ```
  غير كده → أبقِ على السطر الحالي (`/api/lectures/.../stream?t=...`). محتاج تجيب `video_id`+`videos.status` مع الدرس (عدّل الـ select المناسب).
- `lib/free-lecture-data.ts`: نفس المنطق للمحاضرات المجانية.
- `components/student/courses/video-player.tsx`:
  - أضف `useEffect` يكتشف HLS: لو `src` يحوي `/api/hls/` أو ينتهي `.m3u8`:
    - لو `videoRef.current.canPlayType('application/vnd.apple.mpegurl')` (Safari) → `video.src = src` مباشرة.
    - غير كده → `import Hls from 'hls.js'`، `new Hls()`, `hls.loadSource(src)`, `hls.attachMedia(video)`, ونظّف `hls.destroy()` في cleanup.
  - لو `src` MP4 عادي → أبقِ على `<source>` الحالي.
  - **حافظ على كل الأزرار والحماية وRTL** زي ما هي. أضف اختيار الجودة (levels من hls.js) في قائمة الإعدادات (اختياري لكن مفضّل).

**معايير القبول:** `tsc` نظيف؛ المشغّل يفرّق بين HLS وMP4؛ التوافق العكسي كامل (فيديو قديم بلا `video_id` يشتغل عبر `/stream`).

**Gotchas:**
- المسار `[...path]` catch-all: `params.path` مصفوفة، اعمل `.join('/')`.
- **إعادة كتابة المانيفست حرجة:** أسماء الملفات نسبية داخل `prefix`. لا توقّع روابط للـ variant playlists (خليها تمرّ عبر البوابة عشان segments جواها تتوقّع بتوكن حيّ)؛ وقّع بس للـ segments.
- TTL للـ segments = عمر التوكن (3h). كفاية لـ VOD.
- `hls.js` لا يشتغل في SSR — استورده ديناميكيًا داخل `useEffect` أو `'use client'` فقط.

---

## MILESTONE M5 — الوركر (Transcoder) — مشروع مستقل

**الهدف:** مجلد `services/transcoder/` كامل، مشروع Node/TS مستقل، ينشره المستخدم.

**البنية:**
```
services/transcoder/
├── src/
│   ├── index.ts        # وضعان: HTTP wake أو polling loop + /health
│   ├── worker.ts       # claim → download → transcode → upload → mark ready
│   ├── transcode.ts    # ffprobe + بناء أمر FFmpeg من الإعدادات
│   ├── r2.ts           # download raw + upload HLS dir
│   ├── db.ts           # Supabase service role: claimJob/updateProgress/markReady/markError/getSettings
│   └── config.ts       # قراءة env
├── Dockerfile          # node:20-slim + apt install ffmpeg
├── .env.example
├── package.json        # مستقل تمامًا عن مشروع Next
└── README.md           # تعليمات نشر مفصّلة
```

**عقود الدوال:**
```ts
// db.ts
claimJob(workerId: string): Promise<Job | null>              // ينادي rpc('claim_video_job')
getSettings(): Promise<StreamingSettings>
updateProgress(videoId: string, pct: number): Promise<void>
markReady(videoId: string, meta: { durationSeconds; width; height; renditions }): Promise<void>
markError(videoId: string, message: string): Promise<void>
markJobDone(jobId: string): Promise<void>
markJobError(jobId: string, message: string): Promise<void>

// transcode.ts
probe(inputPath: string): Promise<{ width; height; durationSeconds }>
buildRenditions(sourceHeight: number, wanted: string[]): Rendition[]   // يتخطى الأعلى من المصدر
transcodeToHls(inputPath: string, outDir: string, opts: { threads; segmentSeconds; renditions }): Promise<void>
```

**تدفّق `worker.ts`:**
1. `settings = getSettings()`.
2. `job = claimJob(workerId)`؛ لو null → استنى/ارجع.
3. حمّل `videos` row (raw key).
4. نزّل raw من R2 لمجلد مؤقت (`os.tmpdir()`).
5. `probe` → `buildRenditions`.
6. `transcodeToHls` بـ `spawn('ffmpeg', args)`، حدّث `updateProgress` من تحليل stderr (اختياري).
7. ارفع مجلد `hls/{videoId}/` كامل إلى R2.
8. `markReady` + `markJobDone`.
9. نظّف الملفات المؤقتة (finally).
10. عند أي خطأ: `markError` + `markJobError` (إعادة المحاولة تلقائية عبر `attempts < max_attempts`).

**أمر FFmpeg (مرجع):** أمر واحد بـ `-filter_complex` split + scale لكل rendition، `-var_stream_map`, `-hls_time {segmentSeconds}`, `-hls_playlist_type vod`, `-master_pl_name master.m3u8`, `-threads {threads}`. **لا تكبّر فوق دقة المصدر.**

**`index.ts` — وضعان (قابلة للضبط بـ env `WORKER_MODE`):**
- `http`: Express `POST /wake` (محمي بـ `WORKER_WAKE_SECRET` header) يشغّل حلقة سحب حتى يفرّغ الطابور → مناسب scale-to-zero.
- `poll`: كل `POLL_INTERVAL_MS` يفحص الطابور → مناسب always-on.
- `GET /health` يرجّع 200.
- يحترم `max_concurrent_jobs` (شغّل بالتوازي بحد أقصى).

**تحكّم الموارد (كن صادقًا في README):**
- `ffmpeg_threads` → `-threads`. `max_concurrent_jobs` → عدد العمليات المتوازية. دول يتقرأوا من `streaming_settings` بداية كل وظيفة.
- **حدود RAM الصلبة** تُضبط على مستوى الحاوية/المضيف (Railway/Fly limits) — Node مايقدرش يفرضها بدقّة. وثّق ده.

**`Dockerfile`:**
```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

**معايير القبول:** المشروع يبني مستقلًا (`tsc` جواه)، والـ README فيه خطوات نشر واضحة. **مش هيتشغّل داخل v0** — بس الكود جاهز للنشر.

**Gotchas:**
- `package.json` الوركر **منفصل** — لا تخلطه بـ deps مشروع Next. لا تستورد أي شيء من `@/...`.
- FFmpeg يُستدعى بـ `child_process.spawn` (لا wrappers تقيلة).
- استخدم `SUPABASE_SERVICE_ROLE_KEY` (يتخطى RLS).

---

## MILESTONE M6 — لوحة تحكّم الأدمن للاستريمنج

**الهدف:** صفحة `/admin/streaming` للتحكم في الإعدادات ومتابعة الوظائف.

**ملفات جديدة:**
- `app/admin/streaming/page.tsx` (server component، يجيب الإعدادات + آخر الوظائف).
- `app/admin/streaming/actions.ts`:
  ```ts
  getStreamingSettings(): Promise<StreamingSettings>
  updateStreamingSettings(patch: Partial<StreamingSettings>): Promise<{ ok: boolean }>
  listRecentJobs(limit?: number): Promise<JobRow[]>
  retryJob(jobId: string): Promise<{ ok: boolean }>   // يرجّع status='queued', attempts=0
  ```
- `components/streaming/streaming-settings.tsx` (client): 
  - Toggle `streaming_enabled` (المفتاح العام).
  - Slider/Input `ffmpeg_threads`, `max_concurrent_jobs`, `segment_seconds`.
  - Checkboxes `renditions` (360p/480p/720p/1080p).
  - لوحة حالة: عدّادات (queued/processing/ready/error) + جدول آخر الوظائف + زر «إعادة المحاولة».

**ملف معدّل:**
- `components/dashboard/sidebar.tsx`: أضف عنصر في `navItems` **قبل** «الإعدادات»:
  ```ts
  { label: 'الاستريمنج', icon: Clapperboard, href: '/admin/streaming', resource: 'settings', adminOnly: true },
  ```
  واستورد `Clapperboard` (أو `Film`/`Video`) من `lucide-react`. استخدم `resource:'settings'` عشان يتبع صلاحيات الإعدادات.

**معايير القبول:** الصفحة تبني، الحفظ يكتب في `streaming_settings` عبر admin client، `tsc` نظيف. تحقّق بصريًا بالمتصفح إن السايدبار فيه العنصر الجديد والصفحة تفتح.

**Gotchas:**
- الكتابة في `streaming_settings` صف واحد (`id=true`) — استخدم upsert/update onConflict.
- اللوحة أدمن فقط (`adminOnly:true` + تحقق صلاحية داخل الـ actions).

---

## MILESTONE M7 — Webhook + التحقق النهائي

**الهدف:** استقبال إشعار «ready/error» من الوركر (لو الوركر بيستخدم webhook بدل تحديث DB مباشر) + فحص شامل.

**ملف جديد (اختياري حسب تصميم الوركر):**
- `app/api/transcoder/webhook/route.ts`: يتحقق من HMAC (`WORKER_WAKE_SECRET` أو `TRANSCODER_WEBHOOK_SECRET`) ويحدّث `videos`/`video_jobs`. 
  > لو الوركر بيكتب DB مباشرة بالـ service role (الأبسط)، الـ webhook للإشعار/الكاش فقط — وضّح القرار.

**التحقق النهائي:**
1. `pnpm exec tsc --noEmit` نظيف (استبعد الأخطاء غير المتعلقة زي `student-profile-data` لو موجودة مسبقًا).
2. راجع كل نقاط التوافق العكسي.
3. تحقق بصري بالمتصفح (`agent-browser`) لصفحة `/admin/streaming` والسايدبار.
4. اكتب/حدّث `README` النشر.

---

## 4. خريطة الملفات الكاملة (مرجع سريع)

### جديدة
| الملف | Milestone | الغرض |
|-------|-----------|-------|
| `scripts/streaming_system.sql` | M1 | تعديلات DB (يشغّلها المستخدم) |
| `lib/r2.ts` | M2 | عميل R2 + presigned URLs |
| `app/admin/courses/video-actions.ts` | M3 | presign/finalize/status |
| `app/api/hls/[lessonId]/[...path]/route.ts` | M4 | بوابة أمن HLS |
| `services/transcoder/**` | M5 | الوركر الكامل |
| `app/admin/streaming/page.tsx` | M6 | لوحة التحكم |
| `app/admin/streaming/actions.ts` | M6 | actions اللوحة |
| `components/streaming/streaming-settings.tsx` | M6 | UI اللوحة |
| `app/api/transcoder/webhook/route.ts` | M7 | (اختياري) استقبال ready/error |

### معدّلة
| الملف | Milestone | التعديل |
|-------|-----------|---------|
| `components/ui/video-upload-field.tsx` | M3 | رفع مباشر R2 + progress + حالة معالجة |
| `components/courses/admin-lesson-detail.tsx` | M3 | تمرير `videoId` |
| `app/admin/courses/actions.ts` | M3 | `video_id` في `LessonInput`/create/update (مع retry آمن) |
| `lib/student-lectures-data.ts` | M4 | رابط HLS لو `ready` + جلب `video_id`/status |
| `lib/free-lecture-data.ts` | M4 | نفس المنطق للمجاني |
| `components/student/courses/video-player.tsx` | M4 | دعم hls.js + fallback |
| `components/dashboard/sidebar.tsx` | M6 | عنصر «الاستريمنج» |

---

## 5. متغيرات البيئة (مرجع)

**المنصة (Vercel):** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `WORKER_WAKE_URL?`, `WORKER_WAKE_SECRET?` + الموجود `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

**الوركر:** نفس مفاتيح R2 + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `WORKER_WAKE_SECRET` + `WORKER_MODE` (`http`/`poll`) + `POLL_INTERVAL_MS?` + `FFMPEG_PATH?`.

---

## 6. خطوات النشر (للمستخدم — تُكتب في README)

1. إنشاء R2 bucket + مفاتيح API + ضبط **CORS** (يسمح PUT/GET من origin المنصة).
2. ضبط env vars على Vercel وعلى الوركر.
3. تشغيل `scripts/streaming_system.sql` على live DB.
4. بناء ونشر `services/transcoder` (Railway/Fly/VPS) — ffmpeg في Dockerfile.
5. ربط `WORKER_WAKE_URL` (المنصة) بـ endpoint الوركر.
6. رفع فيديو تجريبي والتأكد من `uploaded → queued → processing → ready`، ثم تشغيله كطالب مالك للمحاضرة.

---

## 7. قيود ومخاطر (صريحة)

- **لا اختبار حي** داخل v0 (mock data + وركر خارجي). الاختبار = بناء + `tsc` + منطق + تحقق بصري للـ UI فقط.
- **الوركر لازم يُنشر خارجيًا**؛ Vercel لا يشغّل FFmpeg الطويل.
- **روابط الـ segments الموقّعة** bearer لمدة ~3h (مقبول VOD؛ مربوط بعمر التوكن). ممكن تشديدها لاحقًا.
- **CORS على R2** شرط لنجاح الرفع المباشر والتشغيل — مسؤولية المستخدم.
- **التوافق العكسي:** MP4 القديم على `media` يظل يعمل عبر `/api/lectures/[lessonId]/stream`.
- **بدون watermark** (قرار المستخدم).

---

## 8. ترتيب التنفيذ الموصى به

`M0 → M1 → M2 → M3 → M4 → M6 → M5 → M7`

> ملاحظة: يمكن تقديم M6 (اللوحة) قبل M5 (الوركر) لأن اللوحة تعتمد على الجداول (M1) فقط. الوركر (M5) مستقل ويمكن بناؤه بالتوازي بعد M1. اترك M4 (التشغيل) بعد M3 (الرفع) لأنه يعتمد على وجود `video_id`.
