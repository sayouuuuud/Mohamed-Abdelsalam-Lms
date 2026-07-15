import { posix } from 'node:path'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyVideoToken, isLatestSession } from '@/lib/video-token'
import { userCanAccessLecture } from '@/lib/lecture-access'
import { createR2DownloadUrl } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { lessonId: string; path: string[] }
type AuthorizedVideo = { prefix: string }
type AuthorizationResult =
  | { ok: true; video: AuthorizedVideo }
  | { ok: false; status: 401 | 403 | 404 }

function gatewayBase(req: NextRequest, lessonId: string): string {
  return `${req.nextUrl.origin}/api/hls/${lessonId}`
}

function cleanPrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, '')
}

function safeRelativePath(currentManifest: string, target: string): string | null {
  // Strip an existing query/hash before passing the path through our gateway.
  const targetPath = target.split(/[?#]/, 1)[0]
  const normalized = posix.normalize(
    posix.join(posix.dirname(currentManifest), targetPath),
  )
  if (!normalized || normalized === '..' || normalized.startsWith('../')) return null
  return normalized.replace(/^\/+/, '')
}

async function resolveAuthorizedVideo(
  req: NextRequest,
  lessonId: string,
): Promise<AuthorizationResult> {
  const token = req.nextUrl.searchParams.get('t')
  const payload = verifyVideoToken(token)
  if (!payload || payload.lessonId !== lessonId) {
    return { ok: false, status: 401 }
  }

  // A copied URL is useless without the matching logged-in browser session.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== payload.userId) {
    return { ok: false, status: 401 }
  }

  if (!(await isLatestSession(user.id, lessonId, payload.sid))) {
    return { ok: false, status: 401 }
  }

  // lessons/videos are read through the trusted server client because videos
  // is admin-only under RLS. Entitlement is still scoped to this auth user.
  const admin = createAdminClient()
  const { data: lesson } = await admin
    .from('lessons')
    .select('video_id, lecture_id')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson?.video_id || !lesson.lecture_id) {
    return { ok: false, status: 404 }
  }

  if (!(await userCanAccessLecture(admin, user.id, lesson.lecture_id))) {
    return { ok: false, status: 403 }
  }

  const { data: video } = await admin
    .from('videos')
    .select('id, r2_hls_prefix, status')
    .eq('id', lesson.video_id)
    .maybeSingle()

  if (!video || video.status !== 'ready') {
    return { ok: false, status: 404 }
  }

  return {
    ok: true,
    video: {
      prefix: cleanPrefix(video.r2_hls_prefix || `hls/${video.id}`),
    },
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<Params> },
): Promise<NextResponse> {
  const { lessonId, path } = await context.params
  const token = req.nextUrl.searchParams.get('t') ?? ''
  const filePath = path.join('/')

  const authorization = await resolveAuthorizedVideo(req, lessonId)
  if (!authorization.ok) {
    const message = authorization.status === 401 ? 'غير مسجل الدخول' :
      authorization.status === 403 ? 'غير مصرّح' : 'الفيديو غير موجود أو غير جاهز'
    return NextResponse.json({ error: message }, { status: authorization.status })
  }

  const { prefix } = authorization.video
  const r2Key = `${prefix}/${filePath}`

  if (filePath.endsWith('.m3u8')) {
    const signedUrl = await createR2DownloadUrl(r2Key, 300)
    const response = await fetch(signedUrl, { cache: 'no-store' })
    if (!response.ok) {
      return NextResponse.json({ error: 'ملف الفيديو غير موجود' }, { status: 404 })
    }

    const base = gatewayBase(req, lessonId)
    const rewritten = (await response.text())
      .split('\n')
      .map((line) => {
        const value = line.trim()
        if (!value || value.startsWith('#')) return line
        const relativePath = safeRelativePath(filePath, value)
        if (!relativePath) return line
        return `${base}/${relativePath}?t=${encodeURIComponent(token)}`
      })
      .join('\n')

    return new NextResponse(rewritten, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'private, no-store',
      },
    })
  }

  if (filePath.endsWith('.ts') || filePath.endsWith('.m4s')) {
    const signedUrl = await createR2DownloadUrl(r2Key, 7200)
    return NextResponse.redirect(signedUrl, 302)
  }

  return NextResponse.json({ error: 'نوع ملف غير مدعوم' }, { status: 400 })
}
