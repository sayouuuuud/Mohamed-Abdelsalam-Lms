# Transcoder Worker

خدمة Node.js مستقلة مسؤولة عن تحويل الفيديوهات الخام لـ HLS متعدد الجودات.
تشتغل خارج Vercel (Railway / Fly.io / أي VPS) لأن FFmpeg يحتاج CPU/RAM ووقت طويل.

## البنية

```
src/
  server.ts   ← نقطة الدخول + HTTP server (health + /wake)
  worker.ts   ← job processor: ينزّل → يحوّل → يرفع → يحدّث DB
  ffmpeg.ts   ← wrapper على FFmpeg multi-output HLS
  r2.ts       ← تنزيل وتحميل Cloudflare R2 (S3-compatible)
  db.ts       ← اتصال Supabase: claim jobs + تحديث حالة
```

## متطلبات النشر

- **FFmpeg** مثبّت على السيرفر (في Docker image: `apk add ffmpeg`).
- **Node.js 20+**
- **Environment variables** (انسخ `.env.example` لـ `.env`):

| المتغير | الوصف |
|---|---|
| `DATABASE_URL` | رابط PostgreSQL مباشر للـ worker |
| `WORKER_ID` | اسم ثابت ومميز للنسخة، مثل `coolify-transcoder-1` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 API Token |
| `R2_SECRET_ACCESS_KEY` | R2 API Secret |
| `R2_BUCKET` | اسم الـ bucket |
| `WORKER_MODE` | `http` (scale-to-zero) أو `poll` (always-on) |
| `WORKER_WAKE_SECRET` | سر لحماية endpoint الـ /wake |
| `PORT` | port السيرفر (افتراضي 4000) |
| `POLL_INTERVAL_MS` | وقت الاستطلاع في poll mode (افتراضي 10000) |
| `TMP_DIR` | مجلد الملفات المؤقتة (افتراضي /tmp) |

## تهيئة قاعدة البيانات

قبل نشر صورة الـ worker الجديدة، نفّذ migration التالي مرة واحدة على PostgreSQL:

```text
scripts/fix_transcoder_job_claim.sql
```

الدالة الجديدة `claim_next_video_job(worker_id)` تحجز الصفوف بشكل atomic، وتجدد الـ lease أثناء التحويل، ولا تستعيد job نشط إلا بعد 30 دقيقة من آخر heartbeat.

## طرق النشر

### Coolify (polling — موصى به للـ always-on worker)

- اجعل Build Context هو `/services/transcoder` واستخدم الـ `Dockerfile` الموجود فيه.
- اضبط `WORKER_MODE=poll` و`PORT=4000` و`WORKER_ID` بقيمة فريدة لكل replica.
- اضبط Health Check على `/health` والمنفذ `4000`.
- طبّق migration أعلاه قبل إعادة النشر، ثم راقب السجل للتأكد من ظهور claim واحد فقط لكل job.

### Railway (scale-to-zero)

```bash
# من مجلد services/transcoder
railway init
railway up

# ضبط المتغيرات
railway variables set DATABASE_URL=... WORKER_ID=railway-transcoder-1 ...

# الـ WORKER_WAKE_URL هيكون: https://<your-app>.railway.app/wake
```

### Docker

```bash
docker build -t transcoder .
docker run -p 4000:4000 --env-file .env transcoder
```

### Fly.io

```bash
fly launch --name transcoder --no-deploy
fly secrets set DATABASE_URL=... WORKER_ID=fly-transcoder-1 ...
fly deploy
```

## وضعا التشغيل

### `WORKER_MODE=http` (scale-to-zero — موصى به للمبتدئين)

الوركر "نايم" لما مفيش شغل. المنصة تبعث POST `/wake` بعد كل رفع جديد.
ده بيوفّر في التكلفة لأنك مش بتدفع وهو فاضي.

```
المنصة (Vercel) ──POST /wake──► الوركر يصحى ──► ينفّذ job ──► ينام
```

### `WORKER_MODE=poll`

الوركر يستطلع DB كل `POLL_INTERVAL_MS`. مناسب لو في رفع كثير ومستمر.

## الـ /wake endpoint

```bash
curl -X POST https://your-transcoder.railway.app/wake \
  -H "Authorization: Bearer YOUR_WORKER_WAKE_SECRET"
# → { "queued": true }
```

## Health Check

```bash
curl https://your-transcoder.railway.app/health
# → { "ok": true, "mode": "http", "uptime": 42.3 }
```
