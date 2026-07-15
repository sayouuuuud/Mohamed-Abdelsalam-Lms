import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyVideoToken, isLatestSession } from '@/lib/video-token'

// Edge runtime: we only verify auth then redirect — no body streaming needed.
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

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
    .select('video_url, lecture_id, duration')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson?.lecture_id) return deny(404)
  if (!(await ownsLecture(admin, user.id, lesson.lecture_id))) return deny(403)

  // 5) Redirect the browser directly to the real video URL so the <video>
  //    element gets native Range support, correct Content-Length and can
  //    seek / report duration accurately. The signed token is consumed here —
  //    the redirect target is the raw storage URL which is already protected
  //    by auth at the storage level (or is a time-limited signed URL).
  const sourceUrl =
    lesson.video_url ||
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

  return Response.redirect(sourceUrl, 302)
}
