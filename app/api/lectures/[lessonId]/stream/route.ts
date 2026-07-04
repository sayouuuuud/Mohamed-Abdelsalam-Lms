import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyVideoToken, isLatestSession } from '@/lib/video-token'

// Node runtime: we proxy an upstream file stream with byte-range support.
export const runtime = 'nodejs'
// Never cache protected media on the edge/CDN.
export const dynamic = 'force-dynamic'

// Headers worth forwarding from the upstream (UploadThing) response so the
// browser's <video> element behaves exactly as if it hit the file directly.
const PASS_THROUGH = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
]

function deny(status: number) {
  return new Response(null, { status })
}

// Confirms the student still owns the lecture the lesson belongs to.
async function ownsLecture(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  lectureId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('orders')
    .select('status, order_items!inner ( lecture_id )')
    .eq('student_id', userId)
    .eq('status', 'approved')
    .eq('order_items.lecture_id', lectureId)
    .limit(1)
  return !!data && data.length > 0
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params
  const token = new URL(req.url).searchParams.get('t')

  // 1) Token must be valid, unexpired, and issued for THIS lesson.
  const payload = verifyVideoToken(token)
  if (!payload || payload.lessonId !== lessonId) return deny(401)

  // 2) The request must carry the login cookie of the same student the token
  //    was issued to. A link shared with someone else fails here.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== payload.userId) return deny(401)

  // 3) Only the latest playback session is accepted. Re-opening the lecture
  //    rotates the sid, so older links are rejected here.
  if (!(await isLatestSession(user.id, lessonId, payload.sid))) return deny(401)

  // 4) Resolve the real file + the parent lecture, and re-check ownership.
  const admin = createAdminClient()
  const { data: lesson } = await admin
    .from('lessons')
    .select('video_url, lecture_id')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson?.lecture_id) return deny(404)
  if (!(await ownsLecture(admin, user.id, lesson.lecture_id))) return deny(403)

  // Lessons without an uploaded file fall back to a public sample clip (keeps
  // the demo playable); real lessons stream their protected UploadThing file.
  const sourceUrl =
    lesson.video_url ||
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

  // 5) Proxy the upstream file, forwarding Range for smooth seeking/buffering.
  const range = req.headers.get('range')
  const upstream = await fetch(sourceUrl, {
    headers: range ? { range } : {},
    // Don't forward cookies/credentials to the storage origin.
    cache: 'no-store',
  })

  if (!upstream.ok && upstream.status !== 206) return deny(502)

  const headers = new Headers()
  for (const key of PASS_THROUGH) {
    const value = upstream.headers.get(key)
    if (value) headers.set(key, value)
  }
  if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', 'private, no-store, max-age=0')
  headers.set('content-disposition', 'inline')

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
}
