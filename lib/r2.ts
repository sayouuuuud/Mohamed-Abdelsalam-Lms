/**
 * lib/r2.ts — Cloudflare R2 client
 * S3-compatible بيستخدم @aws-sdk/client-s3
 *
 * متغيرات البيئة المطلوبة (أضفها في Vercel + .env.local):
 *   R2_ACCOUNT_ID       — Cloudflare Account ID
 *   R2_ACCESS_KEY_ID    — R2 API Token Access Key
 *   R2_SECRET_ACCESS_KEY— R2 API Token Secret Key
 *   R2_BUCKET           — اسم الـ bucket
 *   R2_ENDPOINT         — https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ---------------------------------------------------------------
// Singleton client — يُنشأ مرة واحدة طول عمر الـ process
// ---------------------------------------------------------------
function buildR2Client(): S3Client {
  const accountId  = process.env.R2_ACCOUNT_ID
  const endpoint   = process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`
  const accessKey  = process.env.R2_ACCESS_KEY_ID
  const secretKey  = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKey || !secretKey) {
    // في وضع dev بدون متغيرات نرجع client وهمي يطلع error واضح عند الاستخدام
    console.warn('[r2] R2 env vars missing — streaming upload/playback will fail')
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId:     accessKey ?? 'placeholder',
      secretAccessKey: secretKey ?? 'placeholder',
    },
  })
}

let _r2: S3Client | null = null

export function getR2Client(): S3Client {
  if (!_r2) _r2 = buildR2Client()
  return _r2
}

/**
 * isR2Configured — هل كل متغيرات R2 المطلوبة موجودة وغير فارغة؟
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
    process.env.R2_ACCESS_KEY_ID?.trim() &&
    process.env.R2_SECRET_ACCESS_KEY?.trim() &&
    process.env.R2_BUCKET?.trim(),
  )
}

/**
 * checkR2Connection — يتحقق من الاتصال بـ R2 عبر HeadBucket.
 * يُستخدم في زر التشخيص في صفحة الإعدادات.
 */
export async function checkR2Connection(): Promise<{ ok: boolean; message: string }> {
  if (!isR2Configured()) {
    return { ok: false, message: 'متغيرات R2 غير مكتملة (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)' }
  }
  try {
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3')
    await getR2Client().send(new HeadBucketCommand({ Bucket: R2_BUCKET() }))
    return { ok: true, message: `الاتصال بـ R2 ناجح — bucket: ${R2_BUCKET()}` }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `فشل الاتصال بـ R2: ${msg}` }
  }
}

export const R2_BUCKET = () => {
  const b = process.env.R2_BUCKET
  if (!b) throw new Error('[r2] R2_BUCKET env var is not set')
  return b
}

// ---------------------------------------------------------------
// presigned PUT — الأدمن يرفع مباشرة من المتصفح
// expiresIn: ثواني (افتراضي 15 دقيقة)
// ---------------------------------------------------------------
export async function createR2UploadUrl(
  key: string,
  contentType: string,
  expiresIn = 900,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket:      R2_BUCKET(),
    Key:         key,
    ContentType: contentType,
  })
  return getSignedUrl(getR2Client(), cmd, { expiresIn })
}

// ---------------------------------------------------------------
// presigned GET — التشغيل الهجين (segments تُجلب مباشرة من R2)
// expiresIn: ثواني (افتراضي 2 ساعة)
// ---------------------------------------------------------------
export async function createR2DownloadUrl(
  key: string,
  expiresIn = 7200,
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET(),
    Key:    key,
  })
  return getSignedUrl(getR2Client(), cmd, { expiresIn })
}

// ---------------------------------------------------------------
// حذف object من R2
// ---------------------------------------------------------------
export async function deleteR2Object(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: key }),
  )
}

// ---------------------------------------------------------------
// التحقق من وجود object (بدون تنزيله)
// ---------------------------------------------------------------
export async function r2ObjectExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({ Bucket: R2_BUCKET(), Key: key }),
    )
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------
// مساعد: بناء مسارات R2 بشكل موحّد
// ---------------------------------------------------------------
export const r2Keys = {
  /** الملف الخام اللي رفعه الأدمن */
  raw: (videoId: string, ext = 'mp4') => `raw/${videoId}.${ext}`,

  /** manifest الرئيسي للـ HLS */
  hlsMaster: (videoId: string) => `hls/${videoId}/master.m3u8`,

  /** manifest جودة معيّنة */
  hlsPlaylist: (videoId: string, quality: string) =>
    `hls/${videoId}/${quality}/playlist.m3u8`,

  /** segment فردي */
  hlsSegment: (videoId: string, quality: string, index: number) =>
    `hls/${videoId}/${quality}/seg${String(index).padStart(4, '0')}.ts`,

  /** prefix يجمع كل ملفات HLS لفيديو معيّن */
  hlsPrefix: (videoId: string) => `hls/${videoId}/`,
}
