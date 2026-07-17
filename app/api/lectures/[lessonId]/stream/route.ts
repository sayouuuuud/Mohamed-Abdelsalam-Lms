import { prisma } from '@/lib/prisma'
import { verifyVideoToken, isLatestSession } from '@/lib/video-token'
import { userCanAccessLecture } from '@/lib/lecture-access'
import { auth } from '@/auth'

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

  const payload = verifyVideoToken(token)
  if (!payload || payload.lessonId !== lessonId) return deny(401)

  const session = await auth()
  const user = session?.user
  if (!user || user.id !== payload.userId) return deny(401)

  if (!(await isLatestSession(user.id, lessonId, payload.sid))) return deny(401)

  const lesson = await prisma.lessons.findUnique({
    where: { id: lessonId },
    select: { video_url: true, lecture_id: true, duration: true }
  })

  if (!lesson?.lecture_id || !lesson.video_url) return deny(404)
  if (!(await userCanAccessLecture(user.id, lesson.lecture_id))) {
    return deny(403)
  }

  return Response.redirect(lesson.video_url, 302)
}
