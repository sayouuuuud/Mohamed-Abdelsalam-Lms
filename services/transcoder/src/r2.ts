'use strict'
/**
 * r2.ts — الوركر
 * بيتعامل مع Cloudflare R2 (S3-compatible):
 *   - تنزيل الفيديو الخام من R2
 *   - رفع segments + manifests HLS لـ R2 بعد التحويل
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { pipeline } from 'stream/promises'
import path from 'path'
import fs from 'fs/promises'
import { Readable } from 'stream'

// ---------------------------------------------------------------
// singleton client — يُنشأ مرة واحدة ويُعاد استخدامه
// ---------------------------------------------------------------
let _r2: S3Client | null = null

function getR2Client(): S3Client {
  if (_r2) return _r2
  let endpoint = process.env.R2_ENDPOINT
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  
  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  }

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('[transcoder/r2] متغيرات R2 غير مكتملة في .env (تأكد من وجود R2_ENDPOINT أو R2_ACCOUNT_ID)')
  }
  _r2 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  })
  return _r2
}

// ---------------------------------------------------------------
// download: ينزّل ملف خام من R2 إلى مسار محلي مؤقت
// بيستخدم stream مش buffer عشان يدعم ملفات كبيرة
// ---------------------------------------------------------------
export async function downloadRaw(r2Key: string, localPath: string): Promise<void> {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error('[transcoder/r2] R2_BUCKET غير موجود في .env')

  const client = getR2Client()
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: r2Key })
  const { Body } = await client.send(cmd)

  if (!Body || !(Body instanceof Readable)) {
    throw new Error(`[transcoder/r2] فشل جلب الـ stream للملف: ${r2Key}`)
  }

  const writer = createWriteStream(localPath)
  await pipeline(Body, writer)
  console.log(`[transcoder/r2] downloaded ${r2Key} → ${localPath}`)
}

// ---------------------------------------------------------------
// uploadDirectory: يرفع كل محتويات مجلد HLS لـ R2 تحت prefix معيّن
// prefix مثال: "hls/video-id-xxx/"
// ---------------------------------------------------------------
export async function uploadDirectory(localDir: string, r2Prefix: string): Promise<void> {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error('[transcoder/r2] R2_BUCKET غير موجود في .env')

  const client  = getR2Client()
  const entries = await fs.readdir(localDir, { recursive: true })

  // رفع كل الملفات بـ concurrency = 8 (مناسب للـ segments الصغيرة)
  const CONCURRENCY = 8
  let i = 0
  while (i < entries.length) {
    const batch = entries.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (entry) => {
        const fullPath = path.join(localDir, entry as string)
        const stat     = await fs.stat(fullPath)
        if (stat.isDirectory()) return

        const r2Key      = `${r2Prefix}${entry}`
        const body       = createReadStream(fullPath)
        const contentType = getContentType(entry as string)
        const cacheControl = (entry as string).endsWith('.m3u8') 
          ? 'no-cache, no-store, must-revalidate' 
          : 'public, max-age=31536000'

        await client.send(new PutObjectCommand({
          Bucket:      bucket,
          Key:         r2Key,
          Body:        body,
          ContentType: contentType,
          CacheControl: cacheControl,
        }))
        console.log(`[transcoder/r2] uploaded → ${r2Key}`)
      })
    )
    i += CONCURRENCY
  }
}

// ---------------------------------------------------------------
// exists: يتحقق من وجود ملف في R2 (للتحقق قبل الحذف أو إعادة الرفع)
// ---------------------------------------------------------------
export async function existsInR2(r2Key: string): Promise<boolean> {
  const bucket = process.env.R2_BUCKET
  if (!bucket) return false
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }))
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------
// deleteFromR2: يحذف ملف من R2
// ---------------------------------------------------------------
export async function deleteFromR2(r2Key: string): Promise<void> {
  const bucket = process.env.R2_BUCKET
  if (!bucket) return
  try {
    await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: r2Key }))
    console.log(`[transcoder/r2] deleted raw file → ${r2Key}`)
  } catch (err) {
    console.error(`[transcoder/r2] failed to delete ${r2Key}:`, err)
  }
}

// ---------------------------------------------------------------
// helper: يحدّد ContentType حسب امتداد الملف
// ---------------------------------------------------------------
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  switch (ext) {
    case '.m3u8': return 'application/vnd.apple.mpegurl'
    case '.ts':   return 'video/mp2t'
    case '.mp4':  return 'video/mp4'   // fragmented mp4 segments (fMP4 mode)
    default:      return 'application/octet-stream'
  }
}
