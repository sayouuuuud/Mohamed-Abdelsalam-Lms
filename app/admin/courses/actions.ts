'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { createNotification } from '@/lib/notify'
import { logActivity } from '@/lib/audit-log'
import { createR2UploadUrl } from '@/lib/r2'
import crypto from 'crypto'
import { auth } from '@/auth'
import { createPlaybackToken } from '@/lib/video-token'


export type LessonAttachment = {
  name: string
  url: string
  type: 'pdf' | 'doc' | 'image' | 'other'
}

export type AdminLesson = {
  id: string
  slug: string
  title: string
  duration: string
  isFree: boolean
  contentType: 'فيديو' | 'مقال' | 'تمرين'
  sortOrder: number
  videoUrl: string | null
  previewUrl?: string | null
  description: string | null
  attachments: LessonAttachment[]
}

export type AdminLecture = {
  id: string
  slug: string
  title: string
  description: string
  instructor: string | null
  price: number
  oldPrice: number | null
  badge: string | null
  image: string | null
  sortOrder: number
  releaseDate: string | null
  branchId: string
  monthlyCourseId: string | null
  courseSectionId: string | null
  branchTitle: string
  stageId: string
  stageTitle: string
  lessons: AdminLesson[]
  whatYouLearn: string[] | null
  isFree: boolean
}

export type BranchOption = {
  id: string
  title: string
  stageId: string
  stageTitle: string
  monthlyCourses: {
    id: string
    title: string
    sections: { id: string; title: string }[]
  }[]
}

export type LectureInput = {
  branchId: string
  monthlyCourseId?: string | null
  courseSectionId?: string | null
  title: string
  description: string
  instructor?: string | null
  price: number
  oldPrice: number | null
  badge: string | null
  image?: string | null
  releaseDate?: string | null
  whatYouLearn?: string[] | null
  isFree?: boolean
}

export type LessonInput = {
  title: string
  duration: string
  isFree: boolean
  contentType?: 'فيديو' | 'مقال' | 'تمرين'
  videoUrl?: string | null
  description?: string | null
  attachments?: LessonAttachment[]
}

function slugify(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base ? base.slice(0, 24) : 'item'}-${suffix}`
}

async function nextContentOrder(lectureId: string): Promise<number> {
  const [lessonsRes, assignmentsRes] = await Promise.all([
    prisma.lessons.findFirst({
      where: { lecture_id: lectureId },
      orderBy: { sort_order: 'desc' },
      select: { sort_order: true }
    }),
    prisma.assignments.findFirst({
      where: { lecture_id: lectureId },
      orderBy: { sort_order: 'desc' },
      select: { sort_order: true }
    })
  ])
  const maxLesson = lessonsRes?.sort_order ?? 0
  const maxAssignment = assignmentsRes?.sort_order ?? 0
  return Math.max(maxLesson, maxAssignment) + 1
}

export async function getLecturesAdmin(): Promise<AdminLecture[]> {
  const [stages, branches, lectures, lessons] = await Promise.all([
    prisma.stages.findMany({ select: { id: true, title: true, sort_order: true } }),
    prisma.branches.findMany({ select: { id: true, stage_id: true, title: true, sort_order: true } }),
    prisma.lectures.findMany({ orderBy: { created_at: 'desc' } }),
    prisma.lessons.findMany({
      select: { id: true, lecture_id: true, slug: true, title: true, duration: true, is_free: true, sort_order: true, video_url: true, description: true, content_type: true, attachments: true },
      orderBy: { sort_order: 'asc' }
    })
  ])

  const stageById = new Map<string, { title: string }>()
  for (const s of stages) stageById.set(s.id, { title: s.title })

  const branchById = new Map<string, { title: string; stageId: string; stageTitle: string }>()
  for (const b of branches) {
    branchById.set(b.id, {
      title: b.title,
      stageId: b.stage_id,
      stageTitle: stageById.get(b.stage_id)?.title ?? '',
    })
  }

  const lessonsByLecture = new Map<string, AdminLesson[]>()
  for (const row of lessons) {
    const list = lessonsByLecture.get(row.lecture_id) ?? []
    const ct = row.content_type
    list.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      duration: row.duration,
      isFree: !!row.is_free,
      contentType: (ct === 'مقال' || ct === 'تمرين' ? ct : 'فيديو') as AdminLesson['contentType'],
      sortOrder: row.sort_order,
      videoUrl: row.video_url ?? null,
      description: row.description ?? null,
      attachments: Array.isArray(row.attachments) ? (row.attachments as LessonAttachment[]) : [],
    })
    lessonsByLecture.set(row.lecture_id, list)
  }

  return lectures.map((row) => {
    const branch = branchById.get(row.branch_id)
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description ?? '',
      instructor: row.instructor ?? null,
      price: Number(row.price),
      oldPrice: row.old_price != null ? Number(row.old_price) : null,
      badge: row.badge,
      image: row.image ?? null,
      sortOrder: row.sort_order,
      releaseDate: row.release_date ?? null,
      branchId: row.branch_id,
      monthlyCourseId: row.monthly_course_id ?? null,
      courseSectionId: row.monthly_course_section_id ?? null,
      branchTitle: branch?.title ?? '',
      stageId: branch?.stageId ?? '',
      stageTitle: branch?.stageTitle ?? '',
      lessons: lessonsByLecture.get(row.id) ?? [],
      whatYouLearn: Array.isArray(row.what_you_learn) ? (row.what_you_learn as string[]) : null,
      isFree: !!row.is_free,
    }
  })
}

export async function getBranchOptions(): Promise<BranchOption[]> {
  const [stages, branches] = await Promise.all([
    prisma.stages.findMany({ select: { id: true, title: true, sort_order: true }, orderBy: { sort_order: 'asc' } }),
    prisma.branches.findMany({
      select: {
        id: true, stage_id: true, title: true, sort_order: true,
        monthly_courses: {
          select: { id: true, title: true, sort_order: true, monthly_course_sections: { select: { id: true, title: true, sort_order: true } } }
        }
      },
      orderBy: { sort_order: 'asc' }
    }),
  ])

  const stageById = new Map<string, { title: string; order: number }>()
  for (const s of stages) stageById.set(s.id, { title: s.title, order: s.sort_order })

  return branches
    .map((b) => ({
      id: b.id,
      title: b.title,
      stageId: b.stage_id,
      stageTitle: stageById.get(b.stage_id)?.title ?? '',
      monthlyCourses: b.monthly_courses
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((course) => ({
          id: course.id,
          title: course.title,
          sections: course.monthly_course_sections
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((section) => ({ id: section.id, title: section.title })),
        })),
      _stageOrder: stageById.get(b.stage_id)?.order ?? 0,
    }))
    .sort((a, b) => a._stageOrder - b._stageOrder)
    .map(({ _stageOrder, ...rest }) => rest)
}

export async function createMonthlyCourseQuick(input: {
  branchId: string
  title: string
}): Promise<{ id: string; title: string } | { error: string }> {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const title = input.title.trim()
  if (!title || !input.branchId) return { error: 'اكتب اسم الكورس واختر الفرع.' }

  const count = await prisma.monthly_courses.count({ where: { branch_id: input.branchId } })

  try {
    const data = await prisma.monthly_courses.create({
      data: {
        branch_id: input.branchId,
        slug: slugify(title),
        title,
        is_published: true,
        sort_order: count + 1,
      },
      select: { id: true, title: true }
    })

    logActivity({ action: 'create', resource: 'categories', targetLabel: `كورس: ${title}` }).catch(() => {})
    revalidatePath('/admin/courses')
    revalidatePath('/admin/categories')
    revalidatePath('/categories')
    revalidatePath('/')
    return { id: data.id, title: data.title }
  } catch (error: any) {
    return { error: 'تعذّر إنشاء الكورس.' }
  }
}

export async function createLecture(input: LectureInput) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const count = await prisma.lectures.count({ where: { branch_id: input.branchId } })

  try {
    const data = await prisma.lectures.create({
      data: {
        branch_id: input.branchId,
        monthly_course_id: input.monthlyCourseId || null,
        monthly_course_section_id: input.monthlyCourseId ? input.courseSectionId || null : null,
        slug: slugify(input.title),
        title: input.title,
        description: input.description,
        instructor: input.instructor?.trim() || null,
        price: input.price,
        old_price: input.oldPrice,
        badge: input.badge,
        sort_order: count + 1,
        release_date: input.releaseDate || null,
        what_you_learn: input.whatYouLearn || [],
        is_free: input.isFree ?? false,
        image: input.image || null,
      },
      select: { id: true, slug: true }
    })

    await notifyLectureGrade(input.branchId, input.title)

    if (input.releaseDate) {
      const latest = await prisma.calendar_events.findFirst({ select: { code: true }, orderBy: { code: 'desc' } })
      let nextNum = 1
      if (latest && latest.code.startsWith('EVT-')) {
        const num = parseInt(latest.code.replace('EVT-', ''), 10)
        if (!isNaN(num)) nextNum = num + 1
      }
      const code = `EVT-${String(nextNum).padStart(2, '0')}`

      const parsedDate = new Date(input.releaseDate)
      const d = parsedDate.toISOString().slice(0, 10)
      const t = parsedDate.toTimeString().slice(0, 5)

      const branch = await prisma.branches.findUnique({ where: { id: input.branchId }, select: { stage_id: true } })

      await prisma.calendar_events.create({
        data: {
          code,
          title: `موعد نزول: ${input.title}`,
          event_date: d,
          event_time: t,
          type: 'محاضرة',
          course: input.title,
          description: input.description,
          custom: false,
          lecture_id: data.id,
          branch_id: input.branchId,
          stage_id: branch?.stage_id,
        }
      })
    }

    logActivity({ action: 'create', resource: 'courses', targetLabel: `محاضرة: ${input.title}` }).catch(() => {})
    revalidatePath('/courses')
    revalidatePath('/calendar')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إضافة المحاضرة.' }
  }
}

async function notifyLectureGrade(branchId: string, lectureTitle: string) {
  try {
    const branch = await prisma.branches.findUnique({
      where: { id: branchId },
      select: { stages: { select: { slug: true } } }
    })
    const grade = branch?.stages?.slug
    await createNotification({
      type: 'كورس',
      title: 'محاضرة جديدة متاحة',
      description: `تمت إضافة محاضرة "${lectureTitle}". تقدر تشوفها في صفحة تصفّح المحاضرات.`,
      grade: grade ?? null,
    })
  } catch {
  }
}

export async function updateLecture(id: string, input: LectureInput) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  try {
    await prisma.lectures.update({
      where: { id },
      data: {
        branch_id: input.branchId,
        monthly_course_id: input.monthlyCourseId || null,
        monthly_course_section_id: input.monthlyCourseId ? input.courseSectionId || null : null,
        title: input.title,
        description: input.description,
        instructor: input.instructor?.trim() || null,
        price: input.price,
        old_price: input.oldPrice,
        badge: input.badge,
        release_date: input.releaseDate || null,
        what_you_learn: input.whatYouLearn || [],
        is_free: input.isFree ?? false,
        image: input.image !== undefined ? input.image : undefined,
      }
    })

    if (input.releaseDate) {
      const parsedDate = new Date(input.releaseDate)
      const d = parsedDate.toISOString().slice(0, 10)
      const t = parsedDate.toTimeString().slice(0, 5)

      const existingEvent = await prisma.calendar_events.findFirst({ where: { lecture_id: id }, select: { code: true } })

      if (existingEvent) {
        await prisma.calendar_events.update({
          where: { code: existingEvent.code },
          data: {
            event_date: d,
            event_time: t,
            title: `موعد نزول: ${input.title}`,
            course: input.title,
            description: input.description,
          }
        })
      } else {
        const branch = await prisma.branches.findUnique({ where: { id: input.branchId }, select: { stage_id: true } })
        const latest = await prisma.calendar_events.findFirst({ select: { code: true }, orderBy: { code: 'desc' } })
        let nextNum = 1
        if (latest && latest.code.startsWith('EVT-')) {
          const num = parseInt(latest.code.replace('EVT-', ''), 10)
          if (!isNaN(num)) nextNum = num + 1
        }
        const code = `EVT-${String(nextNum).padStart(2, '0')}`

        await prisma.calendar_events.create({
          data: {
            code,
            title: `موعد نزول: ${input.title}`,
            event_date: d,
            event_time: t,
            type: 'محاضرة',
            course: input.title,
            description: input.description,
            custom: false,
            lecture_id: id,
            branch_id: input.branchId,
            stage_id: branch?.stage_id,
          }
        })
      }
    } else {
      await prisma.calendar_events.deleteMany({ where: { lecture_id: id } })
    }

    logActivity({ action: 'update', resource: 'courses', targetId: id, targetLabel: `محاضرة ID: ${id}` }).catch(() => {})
    revalidatePath('/courses')
    revalidatePath('/calendar')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر تحديث المحاضرة.' }
  }
}

export async function deleteLecture(id: string) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  // await cleanupLectureMedia(id).catch((e) => console.log('[v0] cleanupLectureMedia error:', e))

  try {
    await prisma.lectures.delete({ where: { id } })
    logActivity({ action: 'delete', resource: 'courses', targetId: id, targetLabel: `محاضرة ID: ${id}` }).catch(() => {})
    revalidatePath('/courses')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حذف المحاضرة.' }
  }
}

export async function createLesson(lectureId: string, input: LessonInput) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const sortOrder = await nextContentOrder(lectureId)

  // لو الفيديو عن طريق الـ R2 streaming (بيبدأ بـ __video_id:)
  const isStreamingVideo = input.videoUrl?.startsWith('__video_id:')
  const streamingVideoId = isStreamingVideo ? input.videoUrl!.replace('__video_id:', '') : null

  try {
    const lesson = await prisma.lessons.create({
      data: {
        lecture_id: lectureId,
        slug: slugify(input.title),
        title: input.title,
        duration: input.duration,
        is_free: input.isFree,
        content_type: input.contentType ?? 'فيديو',
        sort_order: sortOrder,
        // لو streaming: video_url=null وvideo_id=معرّف. لو عادي: video_urlكما هي.
        video_url: isStreamingVideo ? null : (input.videoUrl ?? null),
        description: input.description ?? null,
        attachments: input.attachments ?? [],
      },
      select: { id: true },
    })

    // ربط سجل الفيديو بالدرس لو كان streaming
    if (streamingVideoId) {
      await prisma.lessons.update({
        where: { id: lesson.id },
        data: { video_id: streamingVideoId },
      })
      await prisma.videos.update({
        where: { id: streamingVideoId },
        data: { lesson_id: lesson.id },
      })
    }

    logActivity({ action: 'create', resource: 'courses', targetLabel: `درس: ${input.title}` }).catch(() => {})
    revalidatePath('/courses', 'layout')
    revalidatePath('/', 'layout')
    revalidatePath('/student', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إضافة الدرس.' }
  }
}

export async function updateLesson(id: string, input: LessonInput) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  // لو الفيديو عن طريق الـ R2 streaming
  const isStreamingVideo = input.videoUrl?.startsWith('__video_id:')
  const streamingVideoId = isStreamingVideo ? input.videoUrl!.replace('__video_id:', '') : null

  try {
    await prisma.lessons.update({
      where: { id },
      data: {
        title: input.title,
        duration: input.duration,
        is_free: input.isFree,
        content_type: input.contentType ?? 'فيديو',
        // لو streaming: نحط video_url=null ونربط بالـ video_id
        ...(isStreamingVideo
          ? { video_url: null, video_id: streamingVideoId }
          : { 
              video_url: input.videoUrl !== undefined ? input.videoUrl : undefined,
              video_id: input.videoUrl !== undefined ? null : undefined 
            }
        ),
        description: input.description !== undefined ? input.description : undefined,
        attachments: input.attachments !== undefined ? input.attachments : undefined,
      }
    })

    // ربط سجل الفيديو بالدرس لو كان streaming
    if (streamingVideoId) {
      await prisma.videos.update({
        where: { id: streamingVideoId },
        data: { lesson_id: id },
      })
    }

    logActivity({ action: 'update', resource: 'courses', targetId: id, targetLabel: `درس: ${input.title}` }).catch(() => {})
    revalidatePath('/courses', 'layout')
    revalidatePath('/', 'layout')
    revalidatePath('/student', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر تحديث الدرس.' }
  }
}

export async function deleteLesson(id: string) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  // await cleanupLessonMedia(id).catch((e) => console.log('[v0] cleanupLessonMedia error:', e))

  try {
    await prisma.lessons.delete({ where: { id } })
    logActivity({ action: 'delete', resource: 'courses', targetId: id, targetLabel: `درس ID: ${id}` }).catch(() => {})
    revalidatePath('/courses', 'layout')
    revalidatePath('/', 'layout')
    revalidatePath('/student', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حذف الدرس.' }
  }
}

export type QuestionKind = 'mcq' | 'essay' | 'file'

export type AdminAssignmentQuestion = {
  id?: string
  kind: QuestionKind
  question: string
  options: string[]
  correctIndex: number
}

export type AdminAssignment = {
  id: string
  code: string
  title: string
  description: string
  type: 'تسليم' | 'اختبار'
  instructions: string[]
  points: number
  dueDate: string | null
  sortOrder: number
  questions: AdminAssignmentQuestion[]
}

export type AssignmentInput = {
  title: string
  description: string
  type: 'تسليم' | 'اختبار'
  points: number
  dueDate?: string | null
  questions: AdminAssignmentQuestion[]
}

export type AdminContentItem =
  | { kind: 'lesson'; sortOrder: number; lesson: AdminLesson }
  | { kind: 'assignment'; sortOrder: number; assignment: AdminAssignment }

async function getLectureAssignments(lectureId: string): Promise<AdminAssignment[]> {
  const rows = await prisma.assignments.findMany({
    where: { lecture_id: lectureId },
    select: {
      id: true, code: true, type: true, title: true, description: true, instructions: true, points: true, due_date: true, sort_order: true,
      assignment_questions: { select: { id: true, kind: true, question: true, options: true, correct_index: true, position: true } }
    },
    orderBy: { sort_order: 'asc' }
  })

  return rows.map((a) => ({
    id: a.id,
    code: a.code || a.id,
    type: (a.type === 'اختبار' ? 'اختبار' : 'تسليم') as AdminAssignment['type'],
    title: a.title,
    description: a.description ?? '',
    instructions: Array.isArray(a.instructions) ? (a.instructions as string[]) : [],
    points: a.points ?? 0,
    dueDate: a.due_date ? a.due_date.toISOString() : null,
    sortOrder: a.sort_order ?? 0,
    questions: a.assignment_questions
      .sort((x, y) => (x.position ?? 0) - (y.position ?? 0))
      .map((q) => ({
        id: q.id,
        kind: (q.kind as QuestionKind) ?? 'mcq',
        question: q.question,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
        correctIndex: q.correct_index ?? 0,
      })),
  }))
}

export async function getLectureDetailAdmin(id: string): Promise<{ lecture: AdminLecture; content: AdminContentItem[] } | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (!isUuid) return null

  const row = await prisma.lectures.findUnique({ where: { id } })
  if (!row) return null

  const [branch, lessons] = await Promise.all([
    prisma.branches.findUnique({ where: { id: row.branch_id }, select: { id: true, title: true, stage_id: true, stages: { select: { id: true, title: true } } } }),
    prisma.lessons.findMany({
      where: { lecture_id: id },
      select: { id: true, slug: true, title: true, duration: true, is_free: true, sort_order: true, video_url: true, video_id: true, description: true, content_type: true, attachments: true },
      orderBy: { sort_order: 'asc' }
    })
  ])

  const lecture: AdminLecture = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    instructor: row.instructor ?? null,
    price: Number(row.price),
    oldPrice: row.old_price != null ? Number(row.old_price) : null,
    badge: row.badge,
    image: row.image ?? null,
    sortOrder: row.sort_order,
    releaseDate: row.release_date ?? null,
    branchId: row.branch_id,
    monthlyCourseId: row.monthly_course_id ?? null,
    courseSectionId: row.monthly_course_section_id ?? null,
    branchTitle: branch?.title ?? '',
    stageId: branch?.stage_id ?? '',
    stageTitle: branch?.stages?.title ?? '',
    whatYouLearn: Array.isArray(row.what_you_learn) ? (row.what_you_learn as string[]) : null,
    isFree: !!row.is_free,
    lessons: lessons.map((l) => {
      const ct = l.content_type
      return {
        id: l.id,
        slug: l.slug,
        title: l.title,
        duration: l.duration,
        isFree: !!l.is_free,
        contentType: (ct === 'مقال' || ct === 'تمرين' ? ct : 'فيديو') as AdminLesson['contentType'],
        sortOrder: l.sort_order,
        videoUrl: l.video_id ? `__video_id:${l.video_id}` : (l.video_url ?? null),
        description: l.description ?? null,
        attachments: Array.isArray(l.attachments) ? (l.attachments as LessonAttachment[]) : [],
      }
    }),
  }

  const assignments = await getLectureAssignments(id)

  const content: AdminContentItem[] = [
    ...lecture.lessons.map((lesson): AdminContentItem => ({ kind: 'lesson', sortOrder: lesson.sortOrder, lesson })),
    ...assignments.map((assignment): AdminContentItem => ({ kind: 'assignment', sortOrder: assignment.sortOrder, assignment })),
  ].sort((a, b) => a.sortOrder - b.sortOrder)

  return { lecture, content }
}

export async function getLessonDetailAdmin(lessonId: string): Promise<{ lesson: AdminLesson; lectureId: string; lectureTitle: string; lectureImage: string | null; siblings: AdminLesson[] } | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lessonId)
  if (!isUuid) return null

  const row = await prisma.lessons.findUnique({
    where: { id: lessonId },
    select: { id: true, slug: true, lecture_id: true, title: true, duration: true, is_free: true, sort_order: true, video_url: true, video_id: true, description: true, content_type: true, attachments: true }
  })
  if (!row) return null

  const [lecture, siblings] = await Promise.all([
    prisma.lectures.findUnique({ where: { id: row.lecture_id }, select: { id: true, title: true, image: true } }),
    prisma.lessons.findMany({
      where: { lecture_id: row.lecture_id },
      select: { id: true, slug: true, title: true, duration: true, is_free: true, sort_order: true, video_url: true, video_id: true, description: true, content_type: true, attachments: true },
      orderBy: { sort_order: 'asc' }
    })
  ])

  const map = (l: any): AdminLesson => {
    const ct = l.content_type
    return {
      id: l.id,
      slug: l.slug,
      title: l.title,
      duration: l.duration,
      isFree: !!l.is_free,
      contentType: (ct === 'مقال' || ct === 'تمرين' ? ct : 'فيديو') as AdminLesson['contentType'],
      sortOrder: l.sort_order,
      videoUrl: l.video_id ? `__video_id:${l.video_id}` : (l.video_url ?? null),
      previewUrl: undefined,
      description: l.description ?? null,
      attachments: Array.isArray(l.attachments) ? (l.attachments as LessonAttachment[]) : [],
    }
  }

  const session = await auth()
  const userId = session?.user?.id
  const lessonMapped = map(row)
  
  if (row.video_id && userId) {
    const token = await createPlaybackToken(userId, row.id)
    lessonMapped.previewUrl = `/api/hls/${row.id}/master.m3u8?t=${encodeURIComponent(token)}`
  }

  return {
    lesson: lessonMapped,
    lectureId: row.lecture_id,
    lectureTitle: lecture?.title ?? '',
    lectureImage: lecture?.image ?? null,
    siblings: siblings.map(map),
  }
}

function assignmentCode() {
  return `ASG-LEC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

async function replaceAssignmentQuestions(assignmentId: string, questions: AdminAssignmentQuestion[]) {
  await prisma.assignment_questions.deleteMany({ where: { assignment_id: assignmentId } })
  if (questions.length === 0) return null

  const rows = questions.map((q, i) => ({
    assignment_id: assignmentId,
    kind: q.kind,
    question: q.question,
    options: q.kind === 'mcq' ? q.options : [],
    correct_index: q.kind === 'mcq' ? q.correctIndex : 0,
    position: i + 1,
  }))
  try {
    await prisma.assignment_questions.createMany({ data: rows })
    return null
  } catch (error: any) {
    return error
  }
}

export async function createAssignment(lectureId: string, input: AssignmentInput) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const sortOrder = await nextContentOrder(lectureId)

  try {
    const data = await prisma.assignments.create({
      data: {
        code: assignmentCode(),
        lecture_id: lectureId,
        type: input.type ?? 'تسليم',
        title: input.title,
        description: input.description,
        instructions: [],
        points: input.points,
        due_date: input.dueDate ? new Date(input.dueDate) : null,
        sort_order: sortOrder,
      },
      select: { id: true }
    })

    const qErr = await replaceAssignmentQuestions(data.id, input.questions)
    if (qErr) {
      return { error: 'تعذّر حفظ أسئلة الواجب.' }
    }

    logActivity({ action: 'create', resource: 'courses', targetLabel: `واجب: ${input.title}` }).catch(() => {})
    revalidatePath(`/admin/courses/${lectureId}`)
    revalidatePath('/courses', 'layout')
    revalidatePath('/student', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إنشاء الواجب.' }
  }
}

export async function updateAssignment(id: string, input: AssignmentInput) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  try {
    await prisma.assignments.update({
      where: { id },
      data: {
        type: input.type ?? 'تسليم',
        title: input.title,
        description: input.description,
        points: input.points,
        due_date: input.dueDate ? new Date(input.dueDate) : null,
      }
    })

    const qErr = await replaceAssignmentQuestions(id, input.questions)
    if (qErr) {
      return { error: 'تعذّر حفظ أسئلة الواجب.' }
    }

    logActivity({ action: 'update', resource: 'courses', targetId: id, targetLabel: `واجب: ${input.title}` }).catch(() => {})
    revalidatePath('/admin/courses')
    revalidatePath('/courses', 'layout')
    revalidatePath('/student', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر تحديث الواجب.' }
  }
}

export async function deleteAssignment(id: string) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  try {
    await prisma.assignment_questions.deleteMany({ where: { assignment_id: id } })
    await prisma.assignments.delete({ where: { id } })
    logActivity({ action: 'delete', resource: 'courses', targetId: id, targetLabel: `واجب ID: ${id}` }).catch(() => {})
    revalidatePath('/courses', 'layout')
    revalidatePath('/student', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حذف الواجب.' }
  }
}

export async function reorderLectureContent(
  lectureId: string,
  items: { kind: 'lesson' | 'assignment'; id: string }[],
) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  try {
    const promises = items.map((item, i) => {
      if (item.kind === 'lesson') {
        return prisma.lessons.updateMany({
          where: { id: item.id, lecture_id: lectureId },
          data: { sort_order: i + 1 }
        })
      } else {
        return prisma.assignments.updateMany({
          where: { id: item.id, lecture_id: lectureId },
          data: { sort_order: i + 1 }
        })
      }
    })

    await Promise.all(promises)

    revalidatePath(`/admin/courses/${lectureId}`)
    revalidatePath('/courses')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إعادة الترتيب.' }
  }
}

export async function getAttachmentUploadUrl(filename: string, contentType: string) {
  if (!(await hasResourceAccess('courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const ext = filename.split('.').pop() || 'bin'
  const randomName = `${crypto.randomUUID()}.${ext}`
  const key = `attachments/${randomName}`

  try {
    const uploadUrl = await createR2UploadUrl(key, contentType, 900) // 15 mins
    return { uploadUrl, key }
  } catch (error) {
    console.error('[attachments] getAttachmentUploadUrl error:', error)
    return { error: 'فشل في إنشاء رابط الرفع على Cloudflare R2' }
  }
}
