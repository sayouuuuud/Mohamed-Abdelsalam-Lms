/**
 * app/api/hls/[lessonId]/[...path]/route.ts
 * بوابة الأمن الهجينة لملفات HLS
 *
 * التدفّق:
 *  1. التحقق من التوكن الموقّع (نفس منطق stream/route.ts الحالي)
 *  2. للـ manifest (.m3u8): نجلبه من R2 ونعيد كتابة روابط segments لتمرّ عبر هذه البوابة
 *  3. للـ segments (.ts): نُرجع presigned GET URL لـ R2 مباشرة (redirect 302)
 *
 * هجين = manifest عبر السيرفر (حماية) + segments مباشرة من R2 (توفير باندويث)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyVideoToken, isLatestSession } from '@/lib/video-token'
import { createR2DownloadUrl, r2Keys } from '@/lib/r2'

type Params = { lessonId: string; path: string[] }

// ---------------------------------------------------------------
// مساعد: بناء Base URL للبوابة
// ---------------------------------------------------------------
function gatewayBase(req: NextRequest, lessonId: string): string {
  const origin = req.nextUrl.origin
  return `${origin}/api/hls/${lessonId}`
}

// ---------------------------------------------------------------
// التحقق من الملكية — يُعيد videoId أو null
// ---------------------------------------------------------------
async function resolveAuthorizedVideo(
  req: NextRequest,
  lessonId: string,
): Promise<string | null> {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return null

  // تحقق من التوكن الموقّع
  const payload = verifyVideoToken(token)
  if (!payload) return null
  if (payload.lessonId !== lessonId) return null

  // تحقق أن الجلسة هي الأحدث (single-session protection)
  const latest = await isLatestSession(payload.userId, lessonId, payload.sid)
  if (!latest) return null

  // تحقق من قاعدة البيانات
  const supabase = await createClient()
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, video_id')
    .eq('id', lessonId)
    .single()
  if (!lesson?.video_id) return null

  const { data: video } = await supabase
    .from('videos')
    .select('id, r2_hls_prefix, status')
    .eq('id', lesson.video_id)
    .single()
  if (!video || video.status !== 'ready') return null

  return video.id as string
}

// ---------------------------------------------------------------
// GET /api/hls/[lessonId]/[...path]?t=TOKEN
// ---------------------------------------------------------------
export async function GET(
  req: NextRequest,
  context: { params: Promise<Params> },
): Promise<NextResponse> {
  const { lessonId, path } = await context.params
  const token   = req.nextUrl.searchParams.get('t') ?? ''
  const filePath = path.join('/')  // e.g. "master.m3u8" or "720p/playlist.m3u8" or "720p/seg0001.ts"

  const videoId = await resolveAuthorizedVideo(req, lessonId)
  if (!videoId) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  }

  // ---------------------------------------------------------------
  // manifest (.m3u8) — نجلب من R2 ونعيد كتابة الروابط
  // ---------------------------------------------------------------
  if (filePath.endsWith('.m3u8')) {
    const r2Key = `hls/${videoId}/${filePath}`
    const signedUrl = await createR2DownloadUrl(r2Key, 300)

    const res = await fetch(signedUrl)
    if (!res.ok) {
      return NextResponse.json({ error: 'ملف غير موجود' }, { status: 404 })
    }

    const text     = await res.text()
    const base     = gatewayBase(req, lessonId)
    const isMaster = filePath === 'master.m3u8'

    // أعد كتابة الروابط: أضف prefix البوابة + توكن لكل سطر relative
    const rewritten = text
      .split('\n')
      .map((line) => {
        const l = line.trim()
        if (!l || l.startsWith('#')) return line

        if (isMaster) {
          // master.m3u8 يحتوي على روابط nesting مثل "720p/playlist.m3u8"
          return `${base}/${l}?t=${token}`
        } else {
          // playlist.m3u8 يحتوي على segments مثل "seg0001.ts"
          const quality = filePath.split('/')[0]  // e.g. "720p"
          return `${base}/${quality}/${l}?t=${token}`
        }
      })
      .join('\n')

    return new NextResponse(rewritten, {
      headers: {
        'Content-Type':  'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      },
    })
  }

  // ---------------------------------------------------------------
  // segments (.ts) — redirect مباشر لـ R2 presigned URL
  // ---------------------------------------------------------------
  if (filePath.endsWith('.ts')) {
    const r2Key     = `hls/${videoId}/${filePath}`
    const signedUrl = await createR2DownloadUrl(r2Key, 7200)
    return NextResponse.redirect(signedUrl, 302)
  }

  return NextResponse.json({ error: 'نوع ملف غير مدعوم' }, { status: 400 })
}
