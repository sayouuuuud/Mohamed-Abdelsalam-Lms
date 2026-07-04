import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createPlaybackToken } from '@/lib/video-token'
import type {
  Assignment,
  AssignmentStatus,
  CourseDetail,
  CourseItem,
  Lesson,
  QuestionKind,
  Section,
} from '@/lib/student-courses-data'

// The student portal sells individual lectures (from the public catalog:
// stages → branches → lectures → lessons). A student "owns" a lecture once it
// appears in one of their APPROVED orders. This module turns those purchased
// lectures into the CourseDetail shape the portal UI already renders.

const FALLBACK_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

type AssignmentRow = {
  id: string
  code: string
  type: string | null
  title: string
  description: string | null
  instructions: string[] | null
  points: number | null
  sort_order?: number | null
  assignment_questions: {
    id: string
    kind: string | null
    question: string
    options: string[]
    correct_index: number
    position: number | null
  }[]
}

type LectureRow = {
  id: string
  slug: string
  title: string
  description: string | null
  image?: string | null
  instructor?: string | null
  studentsCount?: number
  branches: {
    title: string | null
    image: string | null
    stages: { title: string | null } | null
  } | null
  lessons: {
    id: string
    slug: string
    title: string
    duration: string | null
    is_free: boolean
    sort_order: number | null
    video_url: string | null
    description: string | null
    content_type: string | null
  }[]
  assignments?: AssignmentRow[]
}

// Maps a lesson DB row to the portal Lesson shape.
function mapOneLesson(l: LectureRow['lessons'][number]): Lesson {
  const validTypes = ['فيديو', 'مقال', 'تمرين'] as const
  const rawType = l.content_type ?? 'فيديو'
  const type = (validTypes as readonly string[]).includes(rawType)
    ? (rawType as (typeof validTypes)[number])
    : 'فيديو'
  return {
    id: l.slug,
    lessonId: l.id,
    title: l.title,
    type,
    duration: l.duration ?? '',
    completed: false,
    locked: false,
    videoUrl: l.video_url || FALLBACK_VIDEO,
    description:
      l.description ||
      'درس مشروح بالفيديو خطوة بخطوة مع أمثلة محلولة وتطبيقات على المسائل.',
  }
}

function mapAssignment(row: AssignmentRow, courseSlug: string): Assignment {
  const questions = [...(row.assignment_questions ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((q) => ({
      id: q.id,
      kind: ((q.kind as QuestionKind) ?? 'mcq') as QuestionKind,
      question: q.question,
      options: q.options ?? [],
      correctIndex: q.correct_index,
    }))
  return {
    id: row.id,
    courseId: courseSlug,
    type: row.type === 'اختبار' ? 'اختبار' : 'تسليم',
    title: row.title,
    description: row.description ?? '',
    instructions: row.instructions ?? [],
    dueDate: '',
    points: row.points ?? 10,
    status: 'لم يبدأ',
    attachments: [],
    questions: questions.length > 0 ? questions : undefined,
  }
}

function lectureImage(slug: string) {
  // Each lecture slug has a matching artwork under /public/lessons.
  return `/lessons/${slug}.png`
}

// Progress for a single student: which lessons are completed and the status of
// each assignment (keyed by their database UUIDs).
type Progress = {
  completedLessonIds: Set<string>
  assignmentStatus: Map<string, { status: AssignmentStatus; score: number | null }>
}

const EMPTY_PROGRESS: Progress = {
  completedLessonIds: new Set(),
  assignmentStatus: new Map(),
}

function toCourseDetail(row: LectureRow, progress: Progress = EMPTY_PROGRESS): CourseDetail {
  const sectionId = `${row.slug}-s1`

  // Build one ordered content list interleaving lessons and assignments by
  // their shared sort_order (the order the admin arranged them in).
  const ordered = [
    ...[...row.lessons].map((l) => ({
      sort: l.sort_order ?? 0,
      item: {
        kind: 'lesson' as const,
        lesson: mapOneLesson(l),
        sectionId,
      } satisfies CourseItem,
    })),
    ...[...(row.assignments ?? [])].map((a) => ({
      sort: a.sort_order ?? 0,
      item: {
        kind: 'assignment' as const,
        assignment: mapAssignment(a, row.slug),
        sectionId,
      } satisfies CourseItem,
    })),
  ].sort((a, b) => a.sort - b.sort)

  const items: CourseItem[] = ordered.map((o) => o.item)

  // Apply saved progress, then compute sequential locking: an item is locked
  // until every item before it (lesson or assignment) is completed.
  let prevDone = true
  for (const it of items) {
    if (it.kind === 'lesson') {
      const done = it.lesson.lessonId
        ? progress.completedLessonIds.has(it.lesson.lessonId)
        : false
      it.lesson.completed = done
      it.lesson.locked = !prevDone
      prevDone = prevDone && done
    } else {
      const saved = progress.assignmentStatus.get(it.assignment.id)
      it.assignment.status = saved?.status ?? 'لم يبدأ'
      if (saved?.score != null) it.assignment.score = saved.score
      it.assignment.locked = !prevDone
      const done = saved?.status === 'تم التسليم' || saved?.status === 'مصحّح'
      prevDone = prevDone && done
    }
  }

  const lessons: Lesson[] = items
    .filter((it): it is Extract<CourseItem, { kind: 'lesson' }> => it.kind === 'lesson')
    .map((it) => it.lesson)

  // Security: never send raw storage (UploadThing) URLs to the client. Every
  // student-facing course shape flows through here, so stripping the URL once
  // covers the course list, the outline page, and the player payload. The
  // lesson player re-attaches a signed proxy URL for the single lesson opened.
  for (const l of lessons) l.videoUrl = undefined

  const completedLessons = lessons.filter((l) => l.completed).length

  const sections: Section[] = [
    {
      id: sectionId,
      title: 'محتوى المحاضرة',
      lessons,
      items,
    },
  ]
  return {
    id: row.slug,
    title: row.title,
    instructor: row.instructor?.trim() || 'أ. عبد السلام',
    image: row.image || lectureImage(row.slug),
    category: row.branches?.title ?? 'رياضيات',
    completedLessons,
    totalLessons: lessons.length,
    nextLesson: lessons[0]?.title ?? '',
    description:
      row.description ??
      'محاضرة متكاملة تشرح الموضوع من الأساس مع تمارين وحلول نموذجية.',
    rating: 4.9,
    studentsCount: row.studentsCount ?? 0,
    durationHours: Math.max(1, Math.round(lessons.length * 0.4)),
    level: row.branches?.stages?.title ?? 'الثانوية العامة',
    lastUpdated: '',
    sections,
    whatYouLearn: [
      'فهم المفاهيم الأساسية للموضوع',
      'حل المسائل خطوة بخطوة',
      'تطبيقات على نماذج الامتحانات',
      'مراجعة شاملة قبل الاختبار',
    ],
  }
}

const ASSIGNMENT_SELECT = `
  assignments ( id, code, type, title, description, instructions, points, sort_order,
    assignment_questions ( id, kind, question, options, correct_index, position ) )
`

const LECTURE_SELECT = `
  id, slug, title, description, image, instructor,
  branches:branch_id ( title, image, stages:stage_id ( title ) ),
  lessons ( id, slug, title, duration, is_free, sort_order, video_url, description, content_type ),
  ${ASSIGNMENT_SELECT}
`

// Same projection without the optional `image` column (pre-migration fallback).
const LECTURE_SELECT_NO_IMAGE = `
  id, slug, title, description, instructor,
  branches:branch_id ( title, image, stages:stage_id ( title ) ),
  lessons ( id, slug, title, duration, is_free, sort_order, video_url, description, content_type ),
  ${ASSIGNMENT_SELECT}
`

// Loads the current student's saved progress (completed lessons + assignment
// statuses) for sequential gating.
async function getProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Progress> {
  const { data, error } = await supabase
    .from('student_content_progress')
    .select('item_type, item_id, status, score')
    .eq('user_id', userId)

  const completedLessonIds = new Set<string>()
  const assignmentStatus = new Map<
    string,
    { status: AssignmentStatus; score: number | null }
  >()

  if (error || !data) return { completedLessonIds, assignmentStatus }

  for (const row of data as any[]) {
    if (row.item_type === 'lesson') {
      completedLessonIds.add(row.item_id)
    } else if (row.item_type === 'assignment') {
      assignmentStatus.set(row.item_id, {
        status: (row.status as AssignmentStatus) ?? 'تم التسليم',
        score: row.score ?? null,
      })
    }
  }
  return { completedLessonIds, assignmentStatus }
}

// Distinct lecture ids the current student has purchased (approved orders).
async function getPurchasedLectureIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('status, order_items ( lecture_id )')
    .eq('student_id', userId)
    .eq('status', 'approved')

  if (error || !data) return []

  const ids = new Set<string>()
  for (const order of data as any[]) {
    for (const item of order.order_items ?? []) {
      if (item.lecture_id) ids.add(item.lecture_id)
    }
  }
  return [...ids]
}

// All purchased lectures as portal "courses".
export async function getPurchasedCourses(): Promise<CourseDetail[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const ids = await getPurchasedLectureIds(supabase, user.id)
  if (ids.length === 0) return []

  let res: { data: any; error: any } = await supabase
    .from('lectures')
    .select(LECTURE_SELECT)
    .in('id', ids)

  // Fall back to the legacy select (no `image`) if that column isn't there yet.
  if (res.error && /image/.test(res.error.message)) {
    res = await supabase
      .from('lectures')
      .select(LECTURE_SELECT_NO_IMAGE)
      .in('id', ids)
  }

  if (res.error || !res.data) return []

  // Count distinct approved students per lecture in a single query.
  const lectureIds = (res.data as any[]).map((r) => r.id)
  const { data: countRows } = await supabase
    .from('order_items')
    .select('lecture_id, orders!inner(student_id, status)')
    .in('lecture_id', lectureIds)
    .eq('orders.status', 'approved')

  const studentCountMap = new Map<string, Set<string>>()
  for (const row of countRows ?? []) {
    const sid = (row as any).orders?.student_id
    if (!sid) continue
    const s = studentCountMap.get(row.lecture_id) ?? new Set<string>()
    s.add(sid)
    studentCountMap.set(row.lecture_id, s)
  }

  const progress = await getProgress(supabase, user.id)
  return (res.data as unknown as LectureRow[]).map((row) =>
    toCourseDetail(
      { ...row, studentsCount: studentCountMap.get(row.id)?.size ?? 0 },
      progress,
    ),
  )
}

// One purchased lecture by its slug (used by the course-detail page). Returns
// undefined when the student hasn't purchased it.
export async function getPurchasedCourseDetail(
  slug: string,
): Promise<CourseDetail | undefined> {
  const courses = await getPurchasedCourses()
  return courses.find((c) => c.id === slug)
}

// One purchased lecture's exam/assignment by its id (used by the student
// assignment page). Verifies the student actually owns the parent lecture.
export async function getPurchasedAssignment(
  assignmentId: string,
): Promise<{ assignment: Assignment; course?: CourseDetail } | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return undefined

  const { data: a, error } = await supabase
    .from('assignments')
    .select(
      `id, code, type, title, description, instructions, points, sort_order, lecture_id,
       assignment_questions ( id, kind, question, options, correct_index, position )`,
    )
    .eq('id', assignmentId)
    .maybeSingle()

  if (error || !a || !a.lecture_id) return undefined

  const ids = await getPurchasedLectureIds(supabase, user.id)
  if (!ids.includes(a.lecture_id)) return undefined

  // Resolve the parent lecture (for slug + course context). Pull the assignment
  // straight from the course items so it carries the computed lock + status.
  const courses = await getPurchasedCourses()
  let course: CourseDetail | undefined
  let assignment: Assignment | undefined
  for (const c of courses) {
    for (const s of c.sections) {
      const match = (s.items ?? []).find(
        (it) => it.kind === 'assignment' && it.assignment.id === assignmentId,
      )
      if (match && match.kind === 'assignment') {
        course = c
        assignment = match.assignment
        break
      }
    }
    if (assignment) break
  }

  // Fallback if not found in items (shouldn't normally happen).
  if (!assignment) {
    assignment = mapAssignment(a as unknown as AssignmentRow, course?.id ?? '')
  }

  return { assignment, course }
}

// One lesson inside a purchased lecture (used by the lesson player).
export async function getPurchasedLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<
  { course: CourseDetail; lesson: Lesson; index: number; all: Lesson[] } | undefined
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return undefined

  const course = await getPurchasedCourseDetail(courseSlug)
  if (!course) return undefined
  const all = course.sections.flatMap((s) => s.lessons)
  const index = all.findIndex((l) => l.id === lessonSlug)
  if (index === -1) return undefined

  const lesson = all[index]

  // Never leak the real UploadThing URLs to the browser. Strip them from every
  // lesson in the payload, then hand back a signed proxy URL for ONLY the lesson
  // being opened. Opening the lecture rotates the playback session, so any
  // previously issued link (even one copied from DevTools) stops working.
  for (const s of course.sections) {
    for (const l of s.lessons) l.videoUrl = undefined
  }

  if (lesson.type === 'فيديو' && lesson.lessonId) {
    const token = await createPlaybackToken(user.id, lesson.lessonId)
    lesson.videoUrl = `/api/lectures/${lesson.lessonId}/stream?t=${encodeURIComponent(token)}`
  }

  return { course, lesson, index, all }
}
