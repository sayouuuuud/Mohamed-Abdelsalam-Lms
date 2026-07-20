import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Copy functions from student-lectures-data.ts to test with Ammar's userId
function mapOneLesson(l: any) {
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
    videoUrl: l.video_url || 'fallback',
    description: l.description || 'desc',
    attachments: [],
    _videoId: l.video_id ?? undefined,
    _youtubeUrl: isYoutube ? l.video_url! : undefined,
  }
}

function mapAssignment(row: any, courseSlug: string) {
  return {
    id: row.id,
    courseId: courseSlug,
    type: row.type === 'اختبار' ? 'اختبار' : 'تسليم',
    title: row.title,
    description: row.description ?? '',
    instructions: [],
    dueDate: '',
    points: row.points ?? 10,
    status: 'لم يبدأ',
    attachments: [],
    questions: undefined,
  }
}

function toCourseDetail(row: any, progress: any) {
  const sectionId = `${row.slug}-s1`

  const ordered = [
    ...[...(row.lessons ?? [])].map((l: any) => ({
      sort: l.sort_order ?? 0,
      item: {
        kind: 'lesson' as const,
        lesson: mapOneLesson(l),
        sectionId,
      },
    })),
    ...[...(row.assignments ?? [])].map((a: any) => ({
      sort: a.sort_order ?? 0,
      item: {
        kind: 'assignment' as const,
        assignment: mapAssignment(a, row.slug),
        sectionId,
      },
    })),
  ].sort((a, b) => a.sort - b.sort)

  const items = ordered.map((o) => o.item)

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

  const lessons = items
    .filter((it: any) => it.kind === 'lesson')
    .map((it: any) => it.lesson)

  for (const l of lessons) l.videoUrl = undefined

  const completedLessons = lessons.filter((l: any) => l.completed).length

  return {
    id: row.slug,
    title: row.title,
    instructor: row.instructor?.trim() || 'مدرس',
    image: row.image || 'image',
    category: row.branches?.title ?? 'عام',
    completedLessons,
    totalLessons: lessons.length,
    nextLesson: lessons[0]?.title ?? '',
    description: row.description ?? '',
    rating: 4.9,
    studentsCount: row.studentsCount ?? 0,
    durationHours: '1',
    level: row.branches?.stages?.title ?? 'مرحلة',
    lastUpdated: '',
    sections: [
      {
        id: sectionId,
        title: 'محتوى المحاضرة',
        lessons,
        items,
      },
    ],
    whatYouLearn: [],
  }
}

async function getProgress(userId: string) {
  const data = await prisma.student_content_progress.findMany({
    where: { user_id: userId },
    select: { item_type: true, item_id: true, status: true, score: true }
  })

  const completedLessonIds = new Set<string>()
  const assignmentStatus = new Map<string, any>()

  for (const row of data) {
    if (row.item_type === 'lesson') {
      completedLessonIds.add(row.item_id)
    } else if (row.item_type === 'assignment') {
      assignmentStatus.set(row.item_id, {
        status: row.status ?? 'تم التسليم',
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

async function getPurchasedCourses(userId: string) {
  const ids = await getPurchasedLectureIds(userId)
  if (ids.length === 0) return []

  const data = await prisma.lectures.findMany({
    where: { id: { in: ids } },
    include: {
      branches: { include: { stages: true } },
      lessons: true,
      assignments: { include: { assignment_questions: true } }
    }
  })

  const progress = await getProgress(userId)
  return data.map((row) => toCourseDetail(row, progress))
}

async function getPurchasedCourseDetail(userId: string, slug: string) {
  const courses = await getPurchasedCourses(userId)
  return courses.find((c) => c.id === slug)
}

async function getPurchasedLesson(userId: string, courseSlug: string, lessonSlug: string) {
  const course = await getPurchasedCourseDetail(userId, courseSlug)
  if (!course) return undefined
  const all = course.sections.flatMap((s) => s.lessons)
  const index = all.findIndex((l) => l.id === lessonSlug)
  if (index === -1) return undefined
  return { course, lesson: all[index], index, all }
}

async function main() {
  const userId = '0d545358-45b5-415c-aa05-8220619b9d86' // Ammar's userId
  const courseSlug = 'الاعداد-المركبة-24u1q'
  const lessonSlug = 'مقدمه-9z3cu'
  const lesson = await getPurchasedLesson(userId, courseSlug, lessonSlug)
  console.log('getPurchasedLesson result:')
  console.dir(lesson, { depth: null })
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
