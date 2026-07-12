# نظام Streaming ذاتي للفيديوهات (R2 + FFmpeg + HLS)

> وثيقة تصميم وتنفيذ مفصّلة — للمناقشة والمرجعية أثناء التطوير.
> اللغة: عربي. المصطلحات التقنية بالإنجليزي عمدًا عشان تطابق الكود.

---

## 1. الملخّص التنفيذي

الهدف: استبدال طريقة تشغيل الفيديو الحالية (ملف MP4 واحد بجودة واحدة يمرّ عبر بروكسي على السيرفر) بنظام **streaming حقيقي** مبني ذاتيًا بالكامل، يعتمد على:

- **Cloudflare R2** للتخزين (سحب البيانات / egress مجاني — أرخص بند في الفيديو).
- **FFmpeg** لتحويل الفيديو (transcoding) إلى **HLS** بعدة جودات (adaptive bitrate).
- **worker منفصل** (خارج Vercel) يقوم بالمعالجة التقيلة.
- **بوابة أمن هجينة**: التحقق من الملكية/التوكن عند طلب المانيفست، ثم تسليم الـ segments مباشرة من R2 بروابط موقّعة قصيرة العمر.

**قرارات مثبّتة:**
- ✅ بدون علامة مائية (watermark).
- ✅ خيار في الأدمن لتفعيل/إيقاف الاستريمنج عند الرفع (fallback لـ MP4 القديم).
- ✅ خيار في الأدمن للتحكم في حصة الوركر من الـ CPU/RAM (threads + concurrency).
- ✅ توافق عكسي كامل: الفيديوهات القديمة (`lessons.video_url`) تفضل شغّالة.

---

## 2. المشكلة في النظام الحالي

| الجانب | الوضع الحالي | العيب |
|--------|--------------|-------|
| الرفع | UploadThing → ملف MP4 واحد في `lessons.video_url` | جودة واحدة، مفيش transcoding |
| التشغيل | `<video>` عادي يشغّل MP4 مباشر | مفيش adaptive bitrate |
| التوصيل | (نظام توكن مبني بـ `lib/video-token.ts` + `/api/lectures/[lessonId]/stream`) لكن المشغّل الحالي بيمرّر الرابط الخام | الباندويث بيعدّي على السيرفر = تكلفة + timeout على الفيديوهات الطويلة |
| المعالجة | لا يوجد | الملف يتقدّم زي ما اترفع (كوداك/حجم غير مضبوط) |

**الخلاصة:** ده *progressive download* مش *streaming*. الطالب على نت ضعيف بيقعد يـ buffer، والتكلفة بتتضخّم مع عدد المشاهدات.

---

## 3. البنية المعمارية (Architecture)

```
┌─────────────┐   1. presigned PUT    ┌──────────────────┐
│   الأدمن     │ ────────────────────► │  R2: raw/ (خام)   │
│ (المتصفح)    │   رفع مباشر            └────────┬─────────┘
└─────────────┘                                  │
       │ 2. ينشئ video + job (DB)                │ 3. إشارة/بولينج
       ▼                                          ▼
┌─────────────────┐                    ┌──────────────────────┐
│  المنصة (Vercel) │                    │  الوركر (سيرفر منفصل)  │
│  Next.js         │                    │  Node + FFmpeg        │
│                  │                    │  transcode → HLS      │
│                  │                    └────────┬─────────────┘
│                  │                             │ 4. رفع النتيجة
│                  │                             ▼
│                  │                    ┌──────────────────┐
│                  │  5. webhook "ready" │  R2: hls/ (جاهز)  │
│                  │ ◄───────────────────└──────────────────┘
│                  │     يحدّث DB
└────────┬─────────┘
         │ 6. الطالب يطلب مشاهدة
         ▼
┌──────────────────────────────────────────────┐
│  بوابة الأمن: /api/hls/[lessonId]/[...path]    │
│  - تتحقق من الجلسة + الملكية + التوكن           │
│  - المانيفست: تعيد كتابته بروابط segments موقّعة │
│  - segments: redirect لرابط R2 موقّع قصير       │
└────────┬─────────────────────────────────────┘
         │ 7. hls.js يشغّل مباشرة من R2
         ▼
   المشغّل (video-player.tsx)
```

**ليه الوركر منفصل؟** FFmpeg عملية تقيلة وطويلة (فيديو ساعة ممكن ياخد دقائق طويلة + CPU/RAM كثيف + قرص مؤقت). Vercel serverless بيموت بعد ثواني/دقائق قليلة ومفيهوش FFmpeg مستقر. فالمعالجة **لازم** تخرج لسيرفر دائم (Railway/Fly/VPS) — مع دعم **scale-to-zero** (ينام لما مفيش شغل = مبيتكلّفش وهو فاضي).

---

## 4. تصميم قاعدة البيانات

> كل التعديلات تُكتب في `scripts/streaming_system.sql` ويشغّلها المستخدم يدويًا على الـ live DB (حسب سياسة المشروع). ممنوع أي تعديل DB عبر MCP.

### 4.1 جدول `videos`
يمثّل أصل الفيديو ومساراته في R2 وحالته.

```sql
create table if not exists public.videos (
  id              uuid primary key default gen_random_uuid(),
  status          text not null default 'uploading',
    -- uploading | uploaded | queued | processing | ready | failed
  original_key    text,          -- مسار الملف الخام في R2: raw/<id>/source.mp4
  hls_path        text,          -- مجلد HLS في R2: hls/<id>/
  master_playlist text,          -- hls/<id>/master.m3u8
  duration_sec    integer,
  width           integer,
  height          integer,
  size_bytes      bigint,
  renditions      jsonb not null default '[]'::jsonb, -- [{height:720,bitrate:...}]
  error_message   text,
  created_by      uuid,          -- admin user id
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### 4.2 جدول `video_jobs`
طابور وظائف المعالجة (queue) مع claim آمن للوركر.

```sql
create table if not exists public.video_jobs (
  id            uuid primary key default gen_random_uuid(),
  video_id      uuid not null references public.videos(id) on delete cascade,
  status        text not null default 'pending',
    -- pending | claimed | processing | done | failed
  attempts      integer not null default 0,
  max_attempts  integer not null default 3,
  claimed_at    timestamptz,
  claimed_by    text,          -- معرّف instance الوركر
  progress      integer not null default 0, -- 0..100
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists video_jobs_status_idx on public.video_jobs (status, created_at);
```

### 4.3 جدول `streaming_settings` (صف واحد singleton)
إعدادات يتحكم فيها الأدمن من اللوحة.

```sql
create table if not exists public.streaming_settings (
  id                 boolean primary key default true check (id), -- يضمن صف واحد
  streaming_enabled  boolean not null default true,  -- تفعيل الاستريمنج عند الرفع
  worker_threads     integer not null default 2,     -- عدد threads لكل عملية FFmpeg
  worker_concurrency integer not null default 1,     -- كام فيديو بالتوازي
  renditions         jsonb not null default '[{"height":480,"bitrate":"1000k"},{"height":720,"bitrate":"2800k"},{"height":1080,"bitrate":"5000k"}]'::jsonb,
  updated_at         timestamptz not null default now()
);
insert into public.streaming_settings (id) values (true) on conflict (id) do nothing;
```

### 4.4 ربط الدرس بالفيديو
```sql
alter table public.lessons add column if not exists video_id uuid references public.videos(id);
-- video_url القديم يفضل كما هو (fallback).
```

### 4.5 دالة claim آمنة (تمنع سحب نفس الوظيفة مرتين)
```sql
create or replace function public.claim_video_job(worker_id text)
returns public.video_jobs
language plpgsql
as $$
declare j public.video_jobs;
begin
  select * into j from public.video_jobs
    where status = 'pending' and attempts < max_attempts
    order by created_at
    for update skip locked
    limit 1;
  if not found then return null; end if;
  update public.video_jobs
    set status='claimed', claimed_at=now(), claimed_by=worker_id, attempts=attempts+1, updated_at=now()
    where id = j.id returning * into j;
  return j;
end $$;
```

### 4.6 الأمان (RLS)
- `videos`, `video_jobs`, `streaming_settings`: RLS مفعّل، الوصول للكتابة **admin-only** (service role للوركر).
- القراءة للطالب لا تتم مباشرة من الجداول دي — بتمرّ عبر بوابة الأمن في المنصة.

---

## 5. متغيرات البيئة (Environment Variables)

### على المنصة (Vercel)
| المتغيّر | الوصف |
|----------|-------|
| `R2_ACCOUNT_ID` | حساب Cloudflare |
| `R2_ACCESS_KEY_ID` | مفتاح الوصول |
| `R2_SECRET_ACCESS_KEY` | المفتاح السري |
| `R2_BUCKET` | اسم الـ bucket |
| `R2_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` |
| `TRANSCODER_WEBHOOK_SECRET` | سر توقيع webhook الوركر |
| `TRANSCODER_WAKE_URL` | (اختياري) رابط إيقاظ الوركر عند رفع جديد |

### على الوركر (سيرفر منفصل)
نفس مفاتيح R2 + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `TRANSCODER_WEBHOOK_SECRET` + `PLATFORM_WEBHOOK_URL`.

> تُطلب من المستخدم عبر واجهة الإعدادات (المنصة) وتُضبط يدويًا (الوركر).

---

## 6. تدفّق الرفع (Upload Flow)

1. الأدمن يختار فيديو في محرّر الدرس (`admin-lesson-detail.tsx` → `VideoUploadField`).
2. المنصة تنشئ صف `videos` (status=`uploading`) وتُرجّع **presigned PUT URL** من R2 (`lib/r2.ts`).
3. المتصفح يرفع الملف **مباشرة إلى R2** (يتخطى السيرفر → مفيش حدود مدة، وقابل للاستئناف للملفات الكبيرة) مع شريط تقدّم.
4. عند اكتمال الرفع: المنصة تحدّث `videos.status=uploaded`، وتنشئ `video_jobs` (pending)، وتربط `lessons.video_id`.
5. لو `streaming_settings.streaming_enabled = false`: نتخطّى الـ job ونستخدم الملف مباشرة كـ MP4 (السلوك القديم) — لتبسيط الدنيا وقت الحاجة.
6. (اختياري) المنصة تنادي `TRANSCODER_WAKE_URL` لإيقاظ الوركر فورًا.

---

## 7. الوركر (Transcoder) — `services/transcoder/`

بنية مستقلة بلغة TypeScript/Node، منفصلة تمامًا عن Next.js:

```
services/transcoder/
├── src/
│   ├── index.ts        # نقطة الدخول: HTTP wake أو polling loop
│   ├── worker.ts       # claim job → معالجة → تحديث
│   ├── ffmpeg.ts       # بناء أمر FFmpeg من الإعدادات (renditions/threads)
│   ├── r2.ts           # تنزيل الخام + رفع HLS
│   ├── db.ts           # عميل Supabase (service role)
│   └── config.ts       # قراءة الإعدادات من streaming_settings
├── Dockerfile          # يتضمّن ffmpeg
├── .env.example
├── package.json
└── README.md           # تعليمات النشر (Railway/Fly/VPS)
```

**آلية العمل:**
1. `claim_video_job(workerId)` لسحب وظيفة بأمان.
2. تنزيل الخام من R2 → مجلد مؤقت.
3. `ffprobe` لاستخراج الأبعاد/المدة.
4. FFmpeg يولّد HLS ladder حسب `renditions` (يتخطّى الجودات الأعلى من المصدر) باستخدام `worker_threads`.
5. رفع مجلد `hls/<id>/` (master + variants + segments) إلى R2.
6. تحديث `videos` (ready + metadata) و`video_jobs` (done).
7. استدعاء webhook المنصة `POST /api/transcoder/webhook` (موقّع بـ HMAC).
8. عند الفشل: `status=failed` + `error_message`، وإعادة المحاولة حتى `max_attempts`.

**وضعان للتشغيل:**
- **HTTP wake (scale-to-zero):** الوركر endpoint ينام، يصحى عند نداء المنصة → أرخص.
- **Polling (always-on):** يفحص الطابور كل X ثانية → أبسط لو الرفع كثيف.

**احترام إعدادات الأدمن:** `worker_threads` و`worker_concurrency` و`renditions` تُقرأ من `streaming_settings` في بداية كل وظيفة.

---

## 8. تدفّق التشغيل (Playback) — بوابة الأمن الهجينة

### 8.1 المسار: `app/api/hls/[lessonId]/[...path]/route.ts`
يعيد استخدام منطق التحقق الموجود في `lib/video-token.ts` و`/api/lectures/[lessonId]/stream`:
- التحقق من الجلسة (الطالب مسجّل الدخول أو المحاضرة مجانية `is_free`).
- التحقق من ملكية المحاضرة (اشتراك) — نفس منطق `student-lectures-data.ts`.
- التحقق من single-session token (منع مشاركة الحساب).

### 8.2 التوصيل الهجين
- **طلب المانيفست (`master.m3u8` / variant):** البوابة تجيبه من R2، **تعيد كتابة** مسارات الـ segments بحيث تشير لروابط R2 **موقّعة قصيرة العمر** (مثلًا 60–120 ثانية).
- **طلب segment (`.ts`):** يُخدَم عبر رابط R2 الموقّع مباشرة (redirect) → **الباندويث يعدّي على R2 مش على السيرفر** = أرخص. البوابة بس بتوقّع مش بتمرّر البايتات.

### 8.3 المشغّل: `components/student/courses/video-player.tsx`
- لو الدرس مربوط بـ `video_id` وحالته `ready`: نستخدم **hls.js** (وSafari native HLS) يشغّل `master.m3u8` عبر البوابة.
- غير كده: fallback للسلوك الحالي (`<video>` + `video_url`).
- الحفاظ على واجهة RTL وأزرار الحماية الحالية (منع كليك يمين/تحميل/PiP).

---

## 9. لوحة الأدمن — `/admin/streaming`

صفحة جديدة + عنصر في `components/dashboard/sidebar.tsx`:

- **مفتاح تفعيل الاستريمنج عام** (`streaming_enabled`): لو مقفول → الرفع يستخدم MP4 مباشر (تبسيط).
- **تحكّم موارد الوركر:** `worker_threads` (حصة CPU لكل عملية) + `worker_concurrency` (كام فيديو بالتوازي) — يتحكم في استهلاك CPU/RAM.
- **إدارة الجودات (`renditions`):** إضافة/إزالة جودات (480/720/1080…).
- **حالة الوظائف:** جدول live لـ `video_jobs` (pending/processing/ready/failed) مع نسبة التقدّم.
- **زر إعادة المحاولة** للوظائف الفاشلة.

الحفظ عبر server action يكتب في `streaming_settings` (admin-only).

---

## 10. الملفات المتأثّرة (خريطة التنفيذ)

### جديدة
| الملف | الغرض |
|-------|-------|
| `scripts/streaming_system.sql` | كل تعديلات DB (يشغّلها المستخدم) |
| `lib/r2.ts` | عميل R2 (S3 SDK) + presigned URLs |
| `app/api/videos/presign/route.ts` | إنشاء presigned PUT + صف video |
| `app/api/videos/complete/route.ts` | تأكيد الرفع + إنشاء job |
| `app/api/hls/[lessonId]/[...path]/route.ts` | بوابة أمن HLS |
| `app/api/transcoder/webhook/route.ts` | استقبال "ready/failed" من الوركر |
| `app/admin/streaming/page.tsx` + مكوّناتها | لوحة التحكم |
| `services/transcoder/**` | الوركر الكامل + Dockerfile + README |

### معدّلة
| الملف | التعديل |
|-------|---------|
| `components/ui/video-upload-field.tsx` | رفع مباشر لـ R2 + شريط تقدّم + حالة المعالجة |
| `app/admin/courses/actions.ts` (أو `video-actions.ts`) | ربط `video_id`، منطق التفعيل |
| `components/student/courses/video-player.tsx` | دعم hls.js + fallback |
| `components/dashboard/sidebar.tsx` | عنصر "الاستريمنج" |
| `lib/student-lectures-data.ts` | جلب `video_id`/الحالة مع الدرس |

---

## 11. التوافق العكسي (Backward Compatibility)

- الفيديوهات القديمة في `lessons.video_url` تفضل شغّالة عبر المسار الحالي `/api/lectures/[lessonId]/stream`.
- الدرس الجديد اللي ليه `video_id` + `ready` يستخدم HLS؛ غير كده fallback تلقائي.
- إيقاف `streaming_enabled` يرجّع سلوك MP4 المباشر بالكامل.

---

## 12. التكلفة والأداء

- **R2:** تخزين رخيص + **egress مجاني** (أكبر توفير مقابل S3/CDN تقليدي).
- **الوركر (scale-to-zero):** تدفع دقائق المعالجة الفعلية فقط.
- **الباندويث:** يعدّي على R2 لا على السيرفر → لا timeouts ولا فواتير functions ضخمة.
- **adaptive bitrate:** تشغيل سلس على كل الشبكات والأجهزة.

---

## 13. حدود الاختبار (مهم)

- سيرفر التطوير هنا يعمل بـ **mock data** بدون اتصال DB فعلي، والوركر **خارجي**، فلا يمكن اختبار الفلو حيًّا داخل v0.
- التأكيد النهائي يتم بعد: (1) تشغيل `scripts/streaming_system.sql` على الـ live DB، (2) ضبط env vars، (3) نشر الوركر وربطه بـ R2.
- الاختبار داخل v0 يقتصر على مستوى الكود (بناء + أنواع + مسارات).

---

## 14. خطوات النشر (للمستخدم)

1. إنشاء bucket على Cloudflare R2 + مفاتيح API.
2. ضبط env vars على Vercel (المنصة) وعلى الوركر.
3. تشغيل `scripts/streaming_system.sql` على الـ live DB.
4. بناء ونشر `services/transcoder` (Railway / Fly.io / VPS) مع تثبيت ffmpeg (موجود في Dockerfile).
5. ربط `TRANSCODER_WAKE_URL` و`PLATFORM_WEBHOOK_URL` بين الطرفين.
6. رفع فيديو تجريبي والتأكد من الانتقال `uploaded → processing → ready`.

---

## 15. مراحل التنفيذ المقترحة

1. **DB + R2 client** — السكربت + `lib/r2.ts` + طلب env vars.
2. **الرفع المباشر** — presign/complete + تعديل `VideoUploadField`.
3. **بوابة الأمن + المشغّل** — `/api/hls/**` + hls.js في `video-player`.
4. **الوركر** — `services/transcoder` كامل + Dockerfile + README.
5. **لوحة الأدمن** — `/admin/streaming` + سايدبار + webhook.
