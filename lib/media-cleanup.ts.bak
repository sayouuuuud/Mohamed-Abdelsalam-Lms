/**
 * lib/media-cleanup.ts
 *
 * Best-effort cascade media deletion helper.
 * Called BEFORE the DB row is deleted so we can still read related media URLs.
 * All errors are swallowed (logged only) — never block the DB delete.
 *
 * Storage locations handled:
 *   - UploadThing  (utfs.io or *.ufs.sh URLs)  → UTApi.deleteFiles()
 *   - Cloudflare R2 (HLS prefix + raw key)      → deleteR2Object() per key
 *   - Supabase Storage (*.supabase.co/storage)  → supabase.storage.from().remove()
 */

import { UTApi } from 'uploadthing/server'
import { deleteR2Object, isR2Configured } from '@/lib/r2'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
import type { SupabaseClient } from '@supabase/supabase-js'

const utapi = new UTApi()

// ── Helpers ──────────────────────────────────────────────────────────────────

function isUploadThingUrl(url: string): boolean {
  return url.includes('utfs.io') || url.includes('.ufs.sh')
}

function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase.co/storage')
}

/** Extract UploadThing fileKey from a URL.
 *  URL shape: https://utfs.io/f/<key>  or  https://<app>.ufs.sh/f/<key>
 */
function utKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    const idx = parts.indexOf('f')
    return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : null
  } catch {
    return null
  }
}

/** Extract Supabase Storage bucket + path from a URL.
 *  URL shape: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 */
function supabaseStorageParts(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    // /storage/v1/object/public/<bucket>/<path...>
    const pubIdx = parts.indexOf('public')
    if (pubIdx === -1 || !parts[pubIdx + 1]) return null
    const bucket = parts[pubIdx + 1]
    const path = parts.slice(pubIdx + 2).join('/')
    return path ? { bucket, path } : null
  } catch {
    return null
  }
}

async function deleteUploadThingUrls(urls: string[]): Promise<void> {
  const keys = urls
    .filter(isUploadThingUrl)
    .map(utKeyFromUrl)
    .filter(Boolean) as string[]
  if (keys.length === 0) return
  try {
    await utapi.deleteFiles(keys)
  } catch (err) {
    console.log('[media-cleanup] UploadThing delete error:', err)
  }
}

async function deleteSupabaseStorageUrls(
  supabase: SupabaseClient,
  urls: string[],
): Promise<void> {
  const grouped: Record<string, string[]> = {}
  for (const url of urls) {
    if (!isSupabaseStorageUrl(url)) continue
    const parts = supabaseStorageParts(url)
    if (!parts) continue
    ;(grouped[parts.bucket] ??= []).push(parts.path)
  }
  for (const [bucket, paths] of Object.entries(grouped)) {
    try {
      await supabase.storage.from(bucket).remove(paths)
    } catch (err) {
      console.log('[media-cleanup] Supabase storage delete error:', err)
    }
  }
}

async function deleteR2HlsPrefix(prefix: string): Promise<void> {
  if (!isR2Configured() || !prefix) return
  // We can't ListObjects from Next.js without extra perms; delete the known key
  // patterns for master + quality playlists + segments (up to 9999 segments).
  // The transcoder always writes these keys via r2Keys helpers.
  const { r2Keys } = await import('@/lib/r2')
  const videoId = prefix.replace(/^hls\//, '').replace(/\/$/, '')
  const keys: string[] = [r2Keys.hlsMaster(videoId), r2Keys.raw(videoId)]
  for (const quality of ['360p', '480p', '720p', '1080p']) {
    keys.push(r2Keys.hlsPlaylist(videoId, quality))
    for (let i = 0; i < 9999; i++) {
      keys.push(r2Keys.hlsSegment(videoId, quality, i))
    }
  }
  // Fire and forget each in parallel; ignore 404s
  await Promise.allSettled(keys.map((k) => deleteR2Object(k).catch(() => {})))
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * cleanupLessonMedia
 * Collects and deletes all media referenced by a single lesson:
 *   - video_url (UploadThing or Supabase)
 *   - attachments[].url (UploadThing)
 *   - videos row r2_hls_prefix (R2 HLS tree) + r2_raw_key
 */
export async function cleanupLessonMedia(lessonId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data: lesson } = await supabase
    .from('lessons')
    .select('video_url, attachments, video_id')
    .eq('id', lessonId)
    .single()

  if (!lesson) return

  const urlsToDelete: string[] = []

  // 1) video_url
  if (lesson.video_url && lesson.video_url.startsWith('http')) {
    urlsToDelete.push(lesson.video_url)
  }

  // 2) attachments (array of { url, name, ... })
  const attachments = Array.isArray(lesson.attachments) ? lesson.attachments : []
  for (const a of attachments) {
    if (typeof a?.url === 'string' && a.url.startsWith('http')) {
      urlsToDelete.push(a.url)
    }
  }

  // 3) R2 HLS tree via videos row
  if (lesson.video_id) {
    const { data: video } = await supabase
      .from('videos')
      .select('r2_hls_prefix, r2_raw_key')
      .eq('id', lesson.video_id)
      .single()

    if (video?.r2_hls_prefix) {
      await deleteR2HlsPrefix(video.r2_hls_prefix)
    }
    if (video?.r2_raw_key && isR2Configured()) {
      await deleteR2Object(video.r2_raw_key).catch(() => {})
    }
  }

  await Promise.all([
    deleteUploadThingUrls(urlsToDelete),
    deleteSupabaseStorageUrls(supabase, urlsToDelete),
  ])
}

/**
 * cleanupLectureMedia
 * Collects image + all lessons' media for a lecture.
 */
export async function cleanupLectureMedia(lectureId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data: lecture } = await supabase
    .from('lectures')
    .select('image, lessons(id)')
    .eq('id', lectureId)
    .single()

  if (!lecture) return

  // Image
  const imageUrls = lecture.image ? [lecture.image] : []
  await Promise.all([
    deleteUploadThingUrls(imageUrls),
    deleteSupabaseStorageUrls(supabase, imageUrls),
  ])

  // All lessons
  const lessonIds: string[] = (lecture.lessons as { id: string }[] ?? []).map((l) => l.id)
  await Promise.all(lessonIds.map(cleanupLessonMedia))
}

/**
 * cleanupCourseMedia
 * Collects image + all lectures' media for a monthly course.
 */
export async function cleanupCourseMedia(courseId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data: course } = await supabase
    .from('monthly_courses')
    .select('image, lectures(id)')
    .eq('id', courseId)
    .single()

  if (!course) return

  const imageUrls = course.image ? [course.image] : []
  await Promise.all([
    deleteUploadThingUrls(imageUrls),
    deleteSupabaseStorageUrls(supabase, imageUrls),
  ])

  const lectureIds: string[] = (course.lectures as { id: string }[] ?? []).map((l) => l.id)
  await Promise.all(lectureIds.map(cleanupLectureMedia))
}

/**
 * cleanupBranchMedia — deletes the branch image only
 * (lectures/courses belong to the branch but their cleanup is triggered by
 *  deleteLecture/deleteMonthlyCourse which cascade first in our delete actions)
 */
export async function cleanupBranchMedia(branchId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('branches')
    .select('image')
    .eq('id', branchId)
    .single()
  if (!data?.image) return
  const urls = [data.image]
  await Promise.all([
    deleteUploadThingUrls(urls),
    deleteSupabaseStorageUrls(supabase, urls),
  ])
}

/**
 * cleanupStageMedia — deletes the stage image only
 */
export async function cleanupStageMedia(stageId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('stages')
    .select('image')
    .eq('id', stageId)
    .single()
  if (!data?.image) return
  const urls = [data.image]
  await Promise.all([
    deleteUploadThingUrls(urls),
    deleteSupabaseStorageUrls(supabase, urls),
  ])
}
