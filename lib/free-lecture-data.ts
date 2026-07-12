import { createClient } from '@/lib/supabase/server'
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

// Loads a free lecture and its playable lessons for the public watch page.
// Returns undefined unless the lecture exists and is marked free — so paid
// lectures can never be watched through this route.
export async function getFreeLectureWatch(
  stageSlug: string,
  branchSlug: string,
  courseSlug: string,
  lectureSlug: string,
): Promise<FreeLectureWatch | undefined> {
  const result = await getFreeLectureBySlug(stageSlug, branchSlug, courseSlug, lectureSlug)
  if (!result || !result.lecture.dbId) return undefined

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lessons')
    .select('id, slug, title, duration, description, video_url, attachments, sort_order')
    .eq('lecture_id', result.lecture.dbId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.log('[v0] getFreeLectureWatch lessons error:', error.message)
    return undefined
  }

  const lessons: FreeWatchLesson[] = (data ?? []).map((row: any) => ({
    id: row.slug,
    title: row.title,
    duration: row.duration ?? '',
    description: row.description ?? null,
    videoUrl: row.video_url || FALLBACK_VIDEO,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
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
}
