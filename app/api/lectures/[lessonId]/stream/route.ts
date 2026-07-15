import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyVideoToken, isLatestSession } from '@/lib/video-token'
import { userCanAccessLecture } from '@/lib/lecture-access'

// Node runtime: video-token.ts uses node:crypto which is unavailable in Edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function deny(status: number) {
  return new Response(null, { status })
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
    .select('video_url, lecture_id, duration')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson?.lecture_id || !lesson.video_url) return deny(404)
  if (!(await userCanAccessLecture(admin, user.id, lesson.lecture_id))) {
    return deny(403)
  }

  // 5) Redirect the browser directly to the real video URL so the <video>
  //    element gets native Range support, correct Content-Length and can
  //    seek / report duration accurately. The signed token is consumed here —
  //    the redirect target is the raw storage URL which is already protected
  //    by auth at the storage level (or is a time-limited signed URL).
  return Response.redirect(lesson.video_url, 302)
}
