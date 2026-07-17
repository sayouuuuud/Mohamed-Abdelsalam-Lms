import { prisma } from '@/lib/prisma'
import { getFreeLectureBySlug } from '@/lib/curriculum'
import type { Stage, Branch, MonthlyCourse } from '@/lib/landing-data'

const FALLBACK_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

export type FreeWatchLesson = {
  id: string
  title: string
  duration: string
  description: string | null
  videoUrl: string
  attachments: { name: string; url: string; type: string }[]
}

export type FreeLectureWatch = {
  stage: Stage
  branch: Branch
  course: MonthlyCourse
  lecture: { id: string; title: string; description: string }
  lessons: FreeWatchLesson[]
}

export async function getFreeLectureWatch(
  stageSlug: string,
  branchSlug: string,
  courseSlug: string,
  lectureSlug: string,
): Promise<FreeLectureWatch | undefined> {
  const result = await getFreeLectureBySlug(stageSlug, branchSlug, courseSlug, lectureSlug)
  if (!result || !result.lecture.dbId) return undefined

  try {
    const data = await prisma.lessons.findMany({
      where: { lecture_id: result.lecture.dbId },
      select: { id: true, slug: true, title: true, duration: true, description: true, video_url: true, attachments: true, sort_order: true },
      orderBy: { sort_order: 'asc' }
    })

    const lessons: FreeWatchLesson[] = data.map((row) => ({
      id: row.slug ?? '',
      title: row.title ?? '',
      duration: row.duration ?? '',
      description: row.description ?? null,
      videoUrl: row.video_url || FALLBACK_VIDEO,
      attachments: Array.isArray(row.attachments) ? (row.attachments as any[]) : [],
    }))

    return {
      stage: result.stage,
      branch: result.branch,
      course: result.course,
      lecture: {
        id: result.lecture.id,
        title: result.lecture.title,
        description: result.lecture.description,
      },
      lessons,
    }
  } catch (error: any) {
    console.log('[v0] getFreeLectureWatch lessons error:', error.message)
    return undefined
  }
}
