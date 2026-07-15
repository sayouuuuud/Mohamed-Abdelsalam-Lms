import { createClient } from '@/lib/supabase/server'
import type { Stage, Branch, Lecture, Lesson, MonthlyCourse, Term } from '@/lib/landing-data'

// ── Row shapes coming back from Supabase ───────────────────────────
type StageRow = {
  id: string
  slug: string
  idx: string
  title: string
  subtitle: string
  rows: string[]
  formula: string
  image: string
  accent: string
  term_price: number
  term_old_price: number | null
}

type BranchRow = {
  id: string
  stage_id: string
  slug: string
  title: string
  description: string
  image: string
  topics: string[]
}

type MonthlyCourseRow = {
  id: string
  branch_id: string
  slug: string
  title: string
  description: string
  image: string | null
  price: number
  old_price: number | null
  badge: string | null
  is_published: boolean | null
}

type LectureRow = {
  id: string
  branch_id: string
  monthly_course_id?: string | null
  monthly_course_section_id?: string | null
  course_sort_order?: number | null
  slug: string
  title: string
  description: string
  price: number
  old_price: number | null
  badge: string | null
  image?: string | null
  is_free?: boolean | null
}

type LessonRow = {
  id: string
  lecture_id: string
  slug: string
  title: string
  duration: string
  is_free: boolean
  video_url: string | null
}

function mapLesson(row: LessonRow): Lesson {
  return {
    id: row.slug,
    title: row.title,
    duration: row.duration,
    isFree: row.is_free,
    videoUrl: row.video_url,
  }
}

// Builds the full nested stages → branches → lectures → lessons tree
// from flat queries (one query per level, assembled in memory).
export async function getCurriculum(includeUnpublished = false): Promise<Stage[]> {
  const supabase = await createClient()

  let coursesQuery = supabase
    .from('monthly_courses')
    .select('id, branch_id, slug, title, description, image, price, old_price, badge, is_published')
    .order('sort_order', { ascending: true })

  if (!includeUnpublished) {
    coursesQuery = coursesQuery.eq('is_published', true)
  }

  const [stagesRes, branchesRes, monthlyCoursesRes, lecturesRes, lessonsRes, sectionsRes, termsRes] = await Promise.all([
    supabase
      .from('stages')
      .select('id, slug, idx, title, subtitle, rows, formula, image, accent, term_price, term_old_price')
      .order('sort_order', { ascending: true }),
    supabase
      .from('branches')
      .select('id, stage_id, slug, title, description, image, topics')
      .order('sort_order', { ascending: true }),
    coursesQuery,
    supabase
      .from('lectures')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('lessons')
      .select('id, lecture_id, slug, title, duration, is_free, video_url')
      .order('sort_order', { ascending: true }),
    supabase
      .from('monthly_course_sections')
      .select('id, monthly_course_id, title, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('terms')
      .select('id, stage_id, title, price, old_price')
      .order('sort_order', { ascending: true }),
  ])

  if (stagesRes.error) {
    console.log('[v0] getCurriculum stages error:', stagesRes.error.message)
    return []
  }

  const lessonsByLecture = new Map<string, Lesson[]>()
  for (const row of (lessonsRes.data as LessonRow[]) ?? []) {
    const list = lessonsByLecture.get(row.lecture_id) ?? []
    list.push(mapLesson(row))
    lessonsByLecture.set(row.lecture_id, list)
  }

  const lecturesByBranch = new Map<string, Lecture[]>()
  for (const row of (lecturesRes.data as LectureRow[]) ?? []) {
    const list = lecturesByBranch.get(row.branch_id) ?? []
    list.push({
      id: row.slug,
      dbId: row.id,
      title: row.title,
      description: row.description,
      price: Number(row.price),
      oldPrice: row.old_price != null ? Number(row.old_price) : undefined,
      badge: row.badge ?? undefined,
      image: row.image ?? undefined,
      lessons: lessonsByLecture.get(row.id) ?? [],
      sectionId: row.monthly_course_section_id ?? null,
      isFree: row.is_free ?? false,
    })
    lecturesByBranch.set(row.branch_id, list)
  }

  // Sections per course (best-effort; table may not exist pre-migration).
  const sectionsByCourse = new Map<string, { id: string; title: string }[]>()
  for (const row of (sectionsRes.data as { id: string; monthly_course_id: string; title: string }[]) ?? []) {
    const list = sectionsByCourse.get(row.monthly_course_id) ?? []
    list.push({ id: row.id, title: row.title })
    sectionsByCourse.set(row.monthly_course_id, list)
  }

  const monthlyCoursesByBranch = new Map<string, MonthlyCourse[]>()
  for (const row of (monthlyCoursesRes.data as MonthlyCourseRow[]) ?? []) {
    const branchLectures = lecturesByBranch.get(row.branch_id) ?? []
    const lectureRows = (lecturesRes.data as LectureRow[]) ?? []
    const lectureIds = new Set(
      lectureRows
        .filter((lecture) => lecture.monthly_course_id === row.id)
        .sort((a, b) => (a.course_sort_order ?? 0) - (b.course_sort_order ?? 0))
        .map((lecture) => lecture.id),
    )
    const list = monthlyCoursesByBranch.get(row.branch_id) ?? []
    list.push({
      id: row.slug,
      dbId: row.id,
      title: row.title,
      description: row.description,
      image: row.image ?? undefined,
      price: Number(row.price),
      oldPrice: row.old_price != null ? Number(row.old_price) : undefined,
      badge: row.badge ?? undefined,
      isPublished: row.is_published ?? true,
      lectures: branchLectures.filter((lecture) => lecture.dbId && lectureIds.has(lecture.dbId)),
      sections: sectionsByCourse.get(row.id) ?? [],
    })
    monthlyCoursesByBranch.set(row.branch_id, list)
  }

  const termsByStage = new Map<string, Term[]>()
  for (const row of (termsRes.data ?? []) as any[]) {
    const list = termsByStage.get(row.stage_id) ?? []
    list.push({
      id: row.id,
      title: row.title,
      price: Number(row.price ?? 0),
      oldPrice: row.old_price != null ? Number(row.old_price) : undefined,
    })
    termsByStage.set(row.stage_id, list)
  }

  const branchesByStage = new Map<string, Branch[]>()
  for (const row of (branchesRes.data as BranchRow[]) ?? []) {
    const list = branchesByStage.get(row.stage_id) ?? []
    list.push({
      id: row.slug,
      title: row.title,
      description: row.description,
      image: row.image,
      topics: row.topics ?? [],
      lectures: lecturesByBranch.get(row.id) ?? [],
      monthlyCourses: monthlyCoursesByBranch.get(row.id) ?? [],
    })
    branchesByStage.set(row.stage_id, list)
  }

  return ((stagesRes.data as StageRow[]) ?? []).map((row) => ({
    id: row.slug,
    index: row.idx,
    title: row.title,
    subtitle: row.subtitle,
    rows: row.rows ?? [],
    formula: row.formula,
    image: row.image,
    accent: (row.accent as Stage['accent']) ?? 'emerald',
    termPrice: Number(row.term_price),
    termOldPrice: row.term_old_price != null ? Number(row.term_old_price) : undefined,
    terms: termsByStage.get(row.id) ?? [],
    branches: branchesByStage.get(row.id) ?? [],
  }))
}

export async function getStageBySlug(slug: string): Promise<Stage | undefined> {
  const all = await getCurriculum()
  return all.find((s) => s.id === slug)
}

export async function getBranchBySlug(
  stageSlug: string,
  branchSlug: string,
): Promise<{ stage: Stage; branch: Branch } | undefined> {
  const stage = await getStageBySlug(stageSlug)
  if (!stage) return undefined
  const branch = stage.branches.find((b) => b.id === branchSlug)
  if (!branch) return undefined
  return { stage, branch }
}

// Resolves a single monthly course (with its sections + lectures + lessons)
// inside a branch, used by the public course landing page.
export async function getCourseBySlug(
  stageSlug: string,
  branchSlug: string,
  courseSlug: string,
): Promise<{ stage: Stage; branch: Branch; course: MonthlyCourse } | undefined> {
  const result = await getBranchBySlug(stageSlug, branchSlug)
  if (!result) return undefined
  const course = (result.branch.monthlyCourses ?? []).find((c) => c.id === courseSlug)
  if (!course) return undefined
  return { stage: result.stage, branch: result.branch, course }
}

// Resolves a single free lecture inside a course (public preview watch).
// Returns undefined unless the lecture exists and is marked free.
export async function getFreeLectureBySlug(
  stageSlug: string,
  branchSlug: string,
  courseSlug: string,
  lectureSlug: string,
): Promise<
  { stage: Stage; branch: Branch; course: MonthlyCourse; lecture: Lecture } | undefined
> {
  const result = await getCourseBySlug(stageSlug, branchSlug, courseSlug)
  if (!result) return undefined
  const lecture = result.course.lectures.find((l) => l.id === lectureSlug)
  if (!lecture || (!lecture.isFree && result.course.price !== 0)) return undefined
  return { ...result, lecture }
}
