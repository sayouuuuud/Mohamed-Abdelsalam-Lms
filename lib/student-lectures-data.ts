import 'server-only'
import { prisma } from '@/lib/prisma'
import { createPlaybackToken } from '@/lib/video-token'
import { auth } from '@/auth'
import type {
  Assignment,
  AssignmentStatus,
  CourseDetail,
  CourseItem,
  EnrolledCourseLecture,
  EnrolledCourseSection,
  EnrolledMonthlyCourse,
  Lesson,
  QuestionKind,
  Section,
} from '@/lib/student-courses-data'

const FALLBACK_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

function mapOneLesson(l: any): Lesson & { _videoId?: string; _youtubeUrl?: string } {
  const validTypes = ['فيديو', 'مقال', 'تمرين'] as const
  const rawType = l.content_type ?? 'فيديو'
  const type = (validTypes as readonly string[]).includes(rawType)
    ? (rawType as (typeof validTypes)[number])
    : 'فيديو'
  const isYoutube = l.video_url ? (l.video_url.includes('youtube.com') || l.video_url.includes('youtu.be')) : false
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
    attachments: Array.isArray(l.attachments) ? (l.attachments as any[]).map((a) => ({
      name: a.name,
      url: a.url,
      type: (['pdf','doc','image','other'] as const).includes(a.type as any)
        ? (a.type as 'pdf' | 'doc' | 'image' | 'other')
        : 'other',
    })) : [],
    _videoId: l.video_id ?? undefined,
    _youtubeUrl: isYoutube ? l.video_url! : undefined,
  }
}

function mapAssignment(row: any, courseSlug: string): Assignment {
  const questions = [...(row.assignment_questions ?? [])]
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((q: any) => ({
      id: q.id,
      kind: ((q.kind as QuestionKind) ?? 'mcq') as QuestionKind,
      question: q.question,
      options: (q.options as string[]) ?? [],
      correctIndex: q.correct_index,
    }))
  return {
    id: row.id,
    courseId: courseSlug,
    type: row.type === 'اختبار' ? 'اختبار' : 'تسليم',
    title: row.title,
    description: row.description ?? '',
    instructions: (row.instructions as string[]) ?? [],
    dueDate: '',
    points: row.points ?? 10,
    status: 'لم يبدأ',
    attachments: [],
    questions: questions.length > 0 ? questions : undefined,
  }
}

function lectureImage(slug: string) {
  return `/lessons/${slug}.png`
}

type Progress = {
  completedLessonIds: Set<string>
  assignmentStatus: Map<string, { status: AssignmentStatus; score: number | null }>
}

const EMPTY_PROGRESS: Progress = {
  completedLessonIds: new Set(),
  assignmentStatus: new Map(),
}

function toCourseDetail(row: any, progress: Progress = EMPTY_PROGRESS): CourseDetail {
  const sectionId = `${row.slug}-s1`

  const ordered = [
    ...[...(row.lessons ?? [])].map((l: any) => ({
      sort: l.sort_order ?? 0,
      item: {
        kind: 'lesson' as const,
        lesson: mapOneLesson(l),
        sectionId,
      } satisfies CourseItem,
    })),
    ...[...(row.assignments ?? [])].map((a: any) => ({
      sort: a.sort_order ?? 0,
      item: {
        kind: 'assignment' as const,
        assignment: mapAssignment(a, row.slug),
        sectionId,
      } satisfies CourseItem,
    })),
  ].sort((a, b) => a.sort - b.sort)

  const items: CourseItem[] = ordered.map((o) => o.item)

  let prevDone = true
  for (const it of items) {
    if (it.kind === 'lesson') {
      const done = it.lesson.lessonId
        ? progress.completedLessonIds.has(it.lesson.lessonId)
        : false
      it.lesson.completed = done
      it.lesson.locked = false
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

  for (const l of lessons) l.videoUrl = undefined

  const completedLessons = lessons.filter((l) => l.completed).length

  const allMinutes = lessons.reduce((sum, l) => {
    if (!l.duration) return sum
    const parts = String(l.duration).split(':').map(Number)
    if (parts.length === 2) return sum + (parts[0] ?? 0) + (parts[1] ?? 0) / 60
    if (parts.length === 3) return sum + (parts[0] ?? 0) * 60 + (parts[1] ?? 0) + (parts[2] ?? 0) / 60
    return sum
  }, 0)

  const hoursRaw = allMinutes / 60
  let durationFormatted = '1 ساعة'
  if (hoursRaw > 0 && hoursRaw < 1) {
    durationFormatted = `${Math.round(allMinutes)} دقيقة`
  } else if (hoursRaw >= 1) {
    const rounded = Number(hoursRaw.toFixed(1))
    durationFormatted = rounded === 1 ? '1 ساعة' : rounded === 2 ? 'ساعتين' : `${rounded} ساعة`
  }

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
    instructor: row.instructor?.trim() || 'أ. محمد أحمد',
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
    durationHours: durationFormatted,
    level: row.branches?.stages?.title ?? 'الثانوية العامة',
    lastUpdated: '',
    sections,
    whatYouLearn: row.what_you_learn && (row.what_you_learn as string[]).length > 0 
      ? (row.what_you_learn as string[]) 
      : [],
  }
}

async function getProgress(userId: string): Promise<Progress> {
  const data = await prisma.student_content_progress.findMany({
    where: { user_id: userId },
    select: { item_type: true, item_id: true, status: true, score: true }
  })

  const completedLessonIds = new Set<string>()
  const assignmentStatus = new Map<
    string,
    { status: AssignmentStatus; score: number | null }
  >()

  if (!data) return { completedLessonIds, assignmentStatus }

  for (const row of data) {
    if (row.item_type === 'lesson') {
      completedLessonIds.add(row.item_id)
    } else if (row.item_type === 'assignment') {
      assignmentStatus.set(row.item_id, {
        status: (row.status as AssignmentStatus) ?? 'تم التسليم',
        score: row.score ? Number(row.score) : null,
      })
    }
  }
  return { completedLessonIds, assignmentStatus }
}

async function getPurchasedLectureIds(userId: string): Promise<string[]> {
  const data = await prisma.orders.findMany({
    where: { student_id: userId, status: 'approved' },
    select: { order_items: { select: { lecture_id: true, monthly_course_id: true, term_id: true, item_type: true } } }
  })

  if (!data) return []

  const ids = new Set<string>()
  const courseIds = new Set<string>()
  const termIds = new Set<string>()

  for (const order of data) {
    for (const item of order.order_items) {
      if (item.item_type === 'term_bundle' && item.term_id) {
        termIds.add(item.term_id)
      } else if (item.item_type === 'course_bundle' && item.monthly_course_id) {
        courseIds.add(item.monthly_course_id)
      } else if (item.lecture_id) {
        ids.add(item.lecture_id)
      }
    }
  }

  if (termIds.size > 0) {
    const termCourses = await prisma.monthly_courses.findMany({
      where: { term_id: { in: [...termIds] } },
      select: { id: true }
    })
    for (const row of termCourses) {
      if (row.id) courseIds.add(row.id)
    }
  }

  if (courseIds.size > 0) {
    const courseLectures = await prisma.lectures.findMany({
      where: { monthly_course_id: { in: [...courseIds] } },
      select: { id: true }
    })
    for (const row of courseLectures) {
      if (row.id) ids.add(row.id)
    }
  }

  return [...ids]
}

export async function getPurchasedCourses(): Promise<CourseDetail[]> {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return []

  const ids = await getPurchasedLectureIds(user.id)
  if (ids.length === 0) return []

  const data = await prisma.lectures.findMany({
    where: { id: { in: ids } },
    include: {
      branches: { include: { stages: true } },
      lessons: true,
      assignments: { include: { assignment_questions: true } }
    }
  })

  if (!data || data.length === 0) return []

  const countRows = await prisma.order_items.findMany({
    where: { lecture_id: { in: ids }, orders: { status: 'approved' } },
    select: { lecture_id: true, orders: { select: { student_id: true } } }
  })

  const studentCountMap = new Map<string, Set<string>>()
  for (const row of countRows) {
    const sid = row.orders?.student_id
    if (!sid) continue
    const s = studentCountMap.get(row.lecture_id!) ?? new Set<string>()
    s.add(sid)
    studentCountMap.set(row.lecture_id!, s)
  }

  const progress = await getProgress(user.id)
  return data.map((row) =>
    toCourseDetail(
      { ...row, studentsCount: studentCountMap.get(row.id)?.size ?? 0 },
      progress,
    ),
  )
}

export async function getPurchasedCourseDetail(
  slug: string,
): Promise<CourseDetail | undefined> {
  const courses = await getPurchasedCourses()
  return courses.find((c) => c.id === slug)
}

export async function getEnrolledMonthlyCourses(): Promise<EnrolledMonthlyCourse[]> {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return []

  const orderRows = await prisma.orders.findMany({
    where: { student_id: user.id, status: 'approved' },
    select: { created_at: true, order_items: { select: { monthly_course_id: true, item_type: true } } }
  })

  if (!orderRows) return []

  const enrolledAtByCourse = new Map<string, string>()
  for (const order of orderRows) {
    for (const item of order.order_items) {
      if (item.item_type === 'course_bundle' && item.monthly_course_id) {
        const existing = enrolledAtByCourse.get(item.monthly_course_id)
        const created = order.created_at.toISOString()
        if (!existing || new Date(created) < new Date(existing)) {
          enrolledAtByCourse.set(item.monthly_course_id, created)
        }
      }
    }
  }

  const courseIds = [...enrolledAtByCourse.keys()]
  if (courseIds.length === 0) return []

  const courseRows = await prisma.monthly_courses.findMany({
    where: { id: { in: courseIds } },
    include: { branches: { include: { stages: true } } }
  })

  const lectureRows = await prisma.lectures.findMany({
    where: { monthly_course_id: { in: courseIds } },
    select: {
      id: true,
      slug: true,
      title: true,
      image: true,
      monthly_course_id: true,
      monthly_course_section_id: true,
      course_sort_order: true,
      sort_order: true,
      created_at: true,
      lessons: {
        select: { id: true, slug: true, sort_order: true },
        orderBy: { sort_order: 'asc' },
      },
    }
  })

  const sectionRows = await prisma.monthly_course_sections.findMany({
    where: { monthly_course_id: { in: courseIds } },
    orderBy: { sort_order: 'asc' }
  })

  const sectionsByCourse = new Map<string, EnrolledCourseSection[]>()
  for (const row of sectionRows) {
    const list = sectionsByCourse.get(row.monthly_course_id!) ?? []
    list.push({ id: row.id, title: row.title ?? '' })
    sectionsByCourse.set(row.monthly_course_id!, list)
  }

  const progress = await getProgress(user.id)

  const lecturesByCourse = new Map<string, any[]>()
  for (const row of lectureRows) {
    const list = lecturesByCourse.get(row.monthly_course_id!) ?? []
    list.push(row)
    lecturesByCourse.set(row.monthly_course_id!, list)
  }

  const out: EnrolledMonthlyCourse[] = []
  for (const course of courseRows) {
    const enrolledAt = enrolledAtByCourse.get(course.id) ?? new Date().toISOString()
    const rawLectures = [...(lecturesByCourse.get(course.id) ?? [])].sort(
      (a, b) =>
        (a.course_sort_order ?? 0) - (b.course_sort_order ?? 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )

    let totalLessons = 0
    let completedLessons = 0
    let newLecturesCount = 0
    const lectures: EnrolledCourseLecture[] = rawLectures.map((lecture) => {
      const lectureLessons = (lecture.lessons ?? []) as Array<{
        id: string
        slug: string
        sort_order: number | null
      }>
      const lessonIds = lectureLessons.map((lesson) => lesson.id)
      const done = lessonIds.filter((id) => progress.completedLessonIds.has(id)).length
      const nextLesson =
        lectureLessons.find((lesson) => !progress.completedLessonIds.has(lesson.id)) ??
        lectureLessons[0]
      totalLessons += lessonIds.length
      completedLessons += done

      const addedAt = (lecture.created_at ? lecture.created_at.toISOString() : undefined) ?? enrolledAt
      const isNew = new Date(addedAt) > new Date(enrolledAt) && done === 0
      if (isNew) newLecturesCount += 1

      return {
        id: lecture.slug,
        dbId: lecture.id,
        title: lecture.title,
        image: lecture.image || lectureImage(lecture.slug),
        totalLessons: lessonIds.length,
        completedLessons: done,
        nextLessonId: nextLesson?.slug ?? null,
        isNew,
        addedAt,
        sectionId: lecture.monthly_course_section_id ?? null,
      }
    })

    const progressPercent =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

    out.push({
      id: course.slug ?? '',
      dbId: course.id,
      title: course.title ?? '',
      description: course.description ?? '',
      image: course.image || lectures[0]?.image || lectureImage(course.slug ?? ''),
      branchTitle: course.branches?.title ?? '',
      stageTitle: course.branches?.stages?.title ?? '',
      enrolledAt,
      totalLectures: lectures.length,
      totalLessons,
      completedLessons,
      progressPercent,
      newLecturesCount,
      lectures,
      sections: sectionsByCourse.get(course.id) ?? [],
    })
  }

  out.sort(
    (a, b) =>
      b.newLecturesCount - a.newLecturesCount ||
      new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime(),
  )
  return out
}

export async function getPurchasedAssignment(
  assignmentId: string,
): Promise<{ assignment: Assignment; course?: CourseDetail } | undefined> {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return undefined

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignmentId)
  
  const a = await prisma.assignments.findFirst({
    where: isUuid ? { id: assignmentId } : { code: assignmentId },
    include: { assignment_questions: true }
  })

  if (!a || !a.lecture_id) return undefined

  const ids = await getPurchasedLectureIds(user.id)
  if (!ids.includes(a.lecture_id)) return undefined

  const courses = await getPurchasedCourses()
  let course: CourseDetail | undefined
  let assignment: Assignment | undefined
  for (const c of courses) {
    for (const s of c.sections) {
      const match = (s.items ?? []).find(
        (it) =>
          it.kind === 'assignment' &&
          (it.assignment.id === a.id || it.assignment.id === assignmentId),
      )
      if (match && match.kind === 'assignment') {
        course = c
        assignment = match.assignment
        break
      }
    }
    if (assignment) break
  }

  if (!assignment) {
    assignment = mapAssignment(a, course?.id ?? '')
  }

  return { assignment, course }
}

export async function getPurchasedLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<
  { course: CourseDetail; lesson: Lesson; index: number; all: Lesson[] } | undefined
> {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return undefined

  const course = await getPurchasedCourseDetail(courseSlug)
  if (!course) return undefined
  const all = course.sections.flatMap((s) => s.lessons)
  const index = all.findIndex((l) => l.id === lessonSlug)
  if (index === -1) return undefined

  const lesson = all[index]

  for (const s of course.sections) {
    for (const l of s.lessons) l.videoUrl = undefined
  }

  if (lesson.type === 'فيديو' && lesson.lessonId) {
    const youtubeUrl = (lesson as any)._youtubeUrl as string | undefined
    if (youtubeUrl) {
      lesson.videoUrl = youtubeUrl
    } else {
      const token = await createPlaybackToken(user.id, lesson.lessonId)
      const hlsVideoId = (lesson as any)._videoId as string | undefined
      if (hlsVideoId) {
        lesson.videoUrl = `/api/hls/${lesson.lessonId}/master.m3u8?t=${encodeURIComponent(token)}`
      } else {
        lesson.videoUrl = `/api/lectures/${lesson.lessonId}/stream?t=${encodeURIComponent(token)}`
      }
    }
  }

  return { course, lesson, index, all }
}
