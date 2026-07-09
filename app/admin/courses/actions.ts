'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { createNotification } from '@/lib/notify'
import { logActivity } from '@/lib/audit-log'

// ── Types ─────────────────────────────────────────────────────────
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
  branchTitle: string
  stageId: string
  stageTitle: string
  lessons: AdminLesson[]
  whatYouLearn: string[] | null
}

export type BranchOption = {
  id: string
  title: string
  stageId: string
  stageTitle: string
}

export type LectureInput = {
  branchId: string
  title: string
  description: string
  instructor?: string | null
  price: number
  oldPrice: number | null
  badge: string | null
  image?: string | null
  releaseDate?: string | null
  whatYouLearn?: string[] | null
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

// The next sort_order placing a new item at the end of a lecture's unified
// content list (lessons + assignments share one ordering space).
async function nextContentOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lectureId: string,
): Promise<number> {
  const [lessonsRes, assignmentsRes] = await Promise.all([
    supabase
      .from('lessons')
      .select('sort_order')
      .eq('lecture_id', lectureId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('assignments')
      .select('sort_order')
      .eq('lecture_id', lectureId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const maxLesson = lessonsRes.data?.sort_order ?? 0
  const maxAssignment = assignmentsRes.data?.sort_order ?? 0
  return Math.max(maxLesson, maxAssignment) + 1
}

// ── Read ──────────────────────────────────────────────────────────
export async function getLecturesAdmin(): Promise<AdminLecture[]> {
  const supabase = await createClient()

  const [stagesRes, branchesRes, lecturesRes, lessonsRes] = await Promise.all([
    supabase.from('stages').select('id, title, sort_order'),
    supabase.from('branches').select('id, stage_id, title, sort_order'),
    supabase
      .from('lectures')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('lessons')
      .select('id, lecture_id, slug, title, duration, is_free, sort_order, video_url, description, content_type, attachments')
      .order('sort_order', { ascending: true }),
  ])

  if (lecturesRes.error) {
    console.log('[v0] getLecturesAdmin error:', lecturesRes.error.message)
    return []
  }

  const stageById = new Map<string, { title: string }>()
  for (const s of stagesRes.data ?? []) stageById.set(s.id, { title: s.title })

  const branchById = new Map<
    string,
    { title: string; stageId: string; stageTitle: string }
  >()
  for (const b of branchesRes.data ?? []) {
    branchById.set(b.id, {
      title: b.title,
      stageId: b.stage_id,
      stageTitle: stageById.get(b.stage_id)?.title ?? '',
    })
  }

  const lessonsByLecture = new Map<string, AdminLesson[]>()
  for (const row of lessonsRes.data ?? []) {
    const list = lessonsByLecture.get(row.lecture_id) ?? []
    const ct = row.content_type
    list.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      duration: row.duration,
      isFree: row.is_free,
      contentType: (ct === 'مقال' || ct === 'تمرين' ? ct : 'فيديو') as AdminLesson['contentType'],
      sortOrder: row.sort_order,
      videoUrl: row.video_url ?? null,
      description: row.description ?? null,
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
    })
    lessonsByLecture.set(row.lecture_id, list)
  }

  return (lecturesRes.data ?? []).map((row) => {
    const branch = branchById.get(row.branch_id)
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      instructor: (row as any).instructor ?? null,
      price: Number(row.price),
      oldPrice: row.old_price != null ? Number(row.old_price) : null,
      badge: row.badge,
      image: (row as any).image ?? null,
      sortOrder: row.sort_order,
      releaseDate: row.release_date ?? null,
      branchId: row.branch_id,
      branchTitle: branch?.title ?? '',
      stageId: branch?.stageId ?? '',
      stageTitle: branch?.stageTitle ?? '',
      lessons: lessonsByLecture.get(row.id) ?? [],
      whatYouLearn: (row as any).what_you_learn ?? null,
    }
  })
}

export async function getBranchOptions(): Promise<BranchOption[]> {
  const supabase = await createClient()
  const [stagesRes, branchesRes] = await Promise.all([
    supabase.from('stages').select('id, title, sort_order').order('sort_order'),
    supabase
      .from('branches')
      .select('id, stage_id, title, sort_order')
      .order('sort_order'),
  ])

  const stageById = new Map<string, { title: string; order: number }>()
  for (const s of stagesRes.data ?? [])
    stageById.set(s.id, { title: s.title, order: s.sort_order })

  return (branchesRes.data ?? [])
    .map((b) => ({
      id: b.id,
      title: b.title,
      stageId: b.stage_id,
      stageTitle: stageById.get(b.stage_id)?.title ?? '',
      _stageOrder: stageById.get(b.stage_id)?.order ?? 0,
    }))
    .sort((a, b) => a._stageOrder - b._stageOrder)
    .map(({ _stageOrder, ...rest }) => rest)
}

// ── Lecture CRUD ──────────────────────────────────────────────────
export async function createLecture(input: LectureInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { count } = await supabase
    .from('lectures')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', input.branchId)

  const row: Record<string, any> = {
    branch_id: input.branchId,
    slug: slugify(input.title),
    title: input.title,
    description: input.description,
    instructor: input.instructor?.trim() || null,
    price: input.price,
    old_price: input.oldPrice,
    badge: input.badge,
    sort_order: (count ?? 0) + 1,
    release_date: input.releaseDate || null,
    what_you_learn: input.whatYouLearn || null,
  }
  if (input.image) row.image = input.image

  let { error } = await supabase.from('lectures').insert(row)
  // Retry without `image` if that column doesn't exist yet (migration pending).
  if (error && /image/.test(error.message) && 'image' in row) {
    delete row.image
    ;({ error } = await supabase.from('lectures').insert(row))
  }

  if (error) {
    console.log('[v0] createLecture error:', error.message)
    return { error: 'تعذّر إضافة المحاضرة.' }
  }

  // Notify the students of this lecture's grade that a new lecture is available.
  await notifyLectureGrade(supabase, input.branchId, input.title)

  // Sync with calendar if a release date is provided
  if (input.releaseDate) {
    // Generate a unique code for the event
    const { data: latest } = await supabase.from('calendar_events').select('code').order('code', { ascending: false }).limit(1).single()
    let nextNum = 1
    if (latest && latest.code.startsWith('EVT-')) {
      const num = parseInt(latest.code.replace('EVT-', ''), 10)
      if (!isNaN(num)) nextNum = num + 1
    }
    const code = `EVT-${String(nextNum).padStart(2, '0')}`

    // Parse date and time from the input.releaseDate (which is a full ISO or datetime string)
    // Actually, if it's coming from an input type="datetime-local", it might be "YYYY-MM-DDTHH:mm"
    const parsedDate = new Date(input.releaseDate)
    const d = parsedDate.toISOString().slice(0, 10)
    const t = parsedDate.toTimeString().slice(0, 5)

    const { data: branch } = await supabase.from('branches').select('stage_id').eq('id', input.branchId).single()

    // Assuming we can get the newly created lecture ID using supabase logic or by fetching it.
    // However, insert(row) without select() doesn't return data.
    // Let's refactor the insert above to return the ID, or we fetch it.
    const { data: newLecture } = await supabase.from('lectures').select('id').eq('branch_id', input.branchId).eq('slug', row.slug).single()

    if (newLecture) {
      await supabase.from('calendar_events').insert({
        code,
        title: `موعد نزول: ${input.title}`,
        event_date: d,
        event_time: t,
        type: 'محاضرة',
        course: input.title,
        description: input.description,
        custom: false,
        lecture_id: newLecture.id,
        branch_id: input.branchId,
        stage_id: branch?.stage_id,
      })
    }
  }

  logActivity({ action: 'create', resource: 'courses', targetLabel: `محاضرة: ${input.title}` }).catch(() => {})
  revalidatePath('/courses')
  revalidatePath('/calendar')
  revalidatePath('/')
  return { success: true }
}

// Resolves the stage slug (= grade) for a branch and notifies that grade's
// students about a newly added lecture. Best-effort; never fails the caller.
async function notifyLectureGrade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  lectureTitle: string,
) {
  try {
    const { data: branch } = await supabase
      .from('branches')
      .select('stage_id, stages:stage_id ( slug )')
      .eq('id', branchId)
      .single()
    const grade = (branch as any)?.stages?.slug as string | undefined
    await createNotification({
      type: 'كورس',
      title: 'محاضرة جديدة متاحة',
      description: `تمت إضافة محاضرة "${lectureTitle}". تقدر تشوفها في صفحة تصفّح المحاضرات.`,
      grade: grade ?? null,
    })
  } catch {
    // ignore notification failures
  }
}

export async function updateLecture(id: string, input: LectureInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const patch: Record<string, any> = {
    branch_id: input.branchId,
    title: input.title,
    description: input.description,
    instructor: input.instructor?.trim() || null,
    price: input.price,
    old_price: input.oldPrice,
    badge: input.badge,
    release_date: input.releaseDate || null,
    what_you_learn: input.whatYouLearn || null,
  }
  if (input.image !== undefined) patch.image = input.image

  let { error } = await supabase.from('lectures').update(patch).eq('id', id)
  // Retry without `image` if that column doesn't exist yet (migration pending).
  if (error && /image/.test(error.message) && 'image' in patch) {
    delete patch.image
    ;({ error } = await supabase.from('lectures').update(patch).eq('id', id))
  }

  if (error) {
    console.log('[v0] updateLecture error:', error.message)
    return { error: 'تعذّر تحديث المحاضرة.' }
  }

  // Update or create calendar event
  if (input.releaseDate) {
    const parsedDate = new Date(input.releaseDate)
    const d = parsedDate.toISOString().slice(0, 10)
    const t = parsedDate.toTimeString().slice(0, 5)

    const { data: existingEvent } = await supabase.from('calendar_events').select('code').eq('lecture_id', id).single()

    if (existingEvent) {
      await supabase.from('calendar_events').update({
        event_date: d,
        event_time: t,
        title: `موعد نزول: ${input.title}`,
        course: input.title,
        description: input.description,
      }).eq('lecture_id', id)
    } else {
      const { data: branch } = await supabase.from('branches').select('stage_id').eq('id', input.branchId).single()
      const { data: latest } = await supabase.from('calendar_events').select('code').order('code', { ascending: false }).limit(1).single()
      let nextNum = 1
      if (latest && latest.code.startsWith('EVT-')) {
        const num = parseInt(latest.code.replace('EVT-', ''), 10)
        if (!isNaN(num)) nextNum = num + 1
      }
      const code = `EVT-${String(nextNum).padStart(2, '0')}`

      await supabase.from('calendar_events').insert({
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
      })
    }
  } else {
    // If release date is removed, remove the calendar event
    await supabase.from('calendar_events').delete().eq('lecture_id', id)
  }

  logActivity({ action: 'update', resource: 'courses', targetId: id, targetLabel: `محاضرة ID: ${id}` }).catch(() => {})
  revalidatePath('/courses')
  revalidatePath('/calendar')
  revalidatePath('/')
  return { success: true }
}

export async function deleteLecture(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase.from('lectures').delete().eq('id', id)
  if (error) {
    console.log('[v0] deleteLecture error:', error.message)
    return { error: 'تعذّر حذف المحاضرة.' }
  }
  logActivity({ action: 'delete', resource: 'courses', targetId: id, targetLabel: `محاضرة ID: ${id}` }).catch(() => {})
  revalidatePath('/courses')
  revalidatePath('/')
  return { success: true }
}

// ── Lesson CRUD ───────────────────────────────────────────────────
export async function createLesson(lectureId: string, input: LessonInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const sortOrder = await nextContentOrder(supabase, lectureId)

  const { error } = await supabase.from('lessons').insert({
    lecture_id: lectureId,
    slug: slugify(input.title),
    title: input.title,
    duration: input.duration,
    is_free: input.isFree,
    content_type: input.contentType ?? 'فيديو',
    sort_order: sortOrder,
    video_url: input.videoUrl ?? null,
    description: input.description ?? null,
    attachments: input.attachments ?? [],
  })

  if (error) {
    console.log('[v0] createLesson error:', error.message)
    return { error: 'تعذّر إضافة الدرس.' }
  }
  logActivity({ action: 'create', resource: 'courses', targetLabel: `درس: ${input.title}` }).catch(() => {})
  revalidatePath('/courses')
  revalidatePath('/')
  return { success: true }
}

export async function updateLesson(id: string, input: LessonInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const patch: Record<string, any> = {
    title: input.title,
    duration: input.duration,
    is_free: input.isFree,
    content_type: input.contentType ?? 'فيديو',
  }
  if (input.videoUrl !== undefined) patch.video_url = input.videoUrl
  if (input.description !== undefined) patch.description = input.description
  if (input.attachments !== undefined) patch.attachments = input.attachments

  const { error } = await supabase.from('lessons').update(patch).eq('id', id)

  if (error) {
    console.log('[v0] updateLesson error:', error.message)
    return { error: 'تعذّر تحديث الدرس.' }
  }
  logActivity({ action: 'update', resource: 'courses', targetId: id, targetLabel: `درس: ${input.title}` }).catch(() => {})
  revalidatePath('/courses')
  revalidatePath('/')
  return { success: true }
}

export async function deleteLesson(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) {
    console.log('[v0] deleteLesson error:', error.message)
    return { error: 'تعذّر حذف الدرس.' }
  }
  logActivity({ action: 'delete', resource: 'courses', targetId: id, targetLabel: `درس ID: ${id}` }).catch(() => {})
  revalidatePath('/courses')
  revalidatePath('/')
  return { success: true }
}

// ── Single lecture / lesson detail (admin views) ──────────────────
export async function getLectureDetailAdmin(
  id: string,
): Promise<{ lecture: AdminLecture; content: AdminContentItem[] } | null> {
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from('lectures')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !row) {
    console.log('[v0] getLectureDetailAdmin error:', error?.message)
    return null
  }

  const [branchRes, lessonsRes] = await Promise.all([
    supabase
      .from('branches')
      .select('id, title, stage_id, stages:stage_id ( id, title )')
      .eq('id', row.branch_id)
      .single(),
    supabase
      .from('lessons')
      .select('id, slug, title, duration, is_free, sort_order, video_url, description, content_type')
      .eq('lecture_id', id)
      .order('sort_order', { ascending: true }),
  ])

  const branch = branchRes.data as any
  const lecture: AdminLecture = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    instructor: (row as any).instructor ?? null,
    price: Number(row.price),
    oldPrice: row.old_price != null ? Number(row.old_price) : null,
    badge: row.badge,
    image: (row as any).image ?? null,
    sortOrder: row.sort_order,
    releaseDate: row.release_date ?? null,
    branchId: row.branch_id,
    branchTitle: branch?.title ?? '',
    stageId: branch?.stage_id ?? '',
    stageTitle: branch?.stages?.title ?? '',
    whatYouLearn: (row as any).what_you_learn ?? null,
    lessons: (lessonsRes.data ?? []).map((l) => {
      const ct = (l as any).content_type
      return {
        id: l.id,
        slug: l.slug,
        title: l.title,
        duration: l.duration,
        isFree: l.is_free,
        contentType: (ct === 'مقال' || ct === 'تمرين' ? ct : 'فيديو') as AdminLesson['contentType'],
        sortOrder: l.sort_order,
        videoUrl: l.video_url ?? null,
        description: l.description ?? null,
        attachments: Array.isArray((l as any).attachments) ? (l as any).attachments : [],
      }
    }),
  }

  // Build the unified, ordered content list (lessons + assignments).
  const assignments = await getLectureAssignments(supabase, id)

  const content: AdminContentItem[] = [
    ...lecture.lessons.map(
      (lesson): AdminContentItem => ({
        kind: 'lesson',
        sortOrder: lesson.sortOrder,
        lesson,
      }),
    ),
    ...assignments.map(
      (assignment): AdminContentItem => ({
        kind: 'assignment',
        sortOrder: assignment.sortOrder,
        assignment,
      }),
    ),
  ].sort((a, b) => a.sortOrder - b.sortOrder)

  return { lecture, content }
}

export async function getLessonDetailAdmin(
  lessonId: string,
): Promise<{
  lesson: AdminLesson
  lectureId: string
  lectureTitle: string
  lectureImage: string | null
  siblings: AdminLesson[]
} | null> {
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from('lessons')
    .select('id, slug, lecture_id, title, duration, is_free, sort_order, video_url, description, content_type, attachments')
    .eq('id', lessonId)
    .single()

  if (error || !row) {
    console.log('[v0] getLessonDetailAdmin error:', error?.message)
    return null
  }

  const [lectureRes, siblingsRes] = await Promise.all([
    supabase.from('lectures').select('id, title, image').eq('id', row.lecture_id).single(),
    supabase
      .from('lessons')
      .select('id, slug, title, duration, is_free, sort_order, video_url, description, content_type, attachments')
      .eq('lecture_id', row.lecture_id)
      .order('sort_order', { ascending: true }),
  ])

  const lecture = lectureRes.data as any
  const map = (l: any): AdminLesson => {
    const ct = l.content_type
    return {
      id: l.id,
      slug: l.slug,
      title: l.title,
      duration: l.duration,
      isFree: l.is_free,
      contentType: (ct === 'مقال' || ct === 'تمرين' ? ct : 'فيديو') as AdminLesson['contentType'],
      sortOrder: l.sort_order,
      videoUrl: l.video_url ?? null,
      description: l.description ?? null,
      attachments: Array.isArray(l.attachments) ? l.attachments : [],
    }
  }

  return {
    lesson: map(row),
    lectureId: row.lecture_id,
    lectureTitle: lecture?.title ?? '',
    lectureImage: lecture?.image ?? null,
    siblings: (siblingsRes.data ?? []).map(map),
  }
}

// ── Lecture assignments (واجبات) + unified content ────────────────
// A question can be multiple choice, an essay (written answer), or a file
// upload that the student answers by submitting a file.
export type QuestionKind = 'mcq' | 'essay' | 'file'

export type AdminAssignmentQuestion = {
  id?: string
  kind: QuestionKind
  question: string
  /** خيارات الاختيار من متعدد، تُستخدم فقط عندما يكون النوع mcq */
  options: string[]
  /** رقم الإجابة الصحيحة، يُستخدم فقط عندما يكون النوع mcq */
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

// A single ordered entry in a lecture's content list.
export type AdminContentItem =
  | { kind: 'lesson'; sortOrder: number; lesson: AdminLesson }
  | { kind: 'assignment'; sortOrder: number; assignment: AdminAssignment }

async function getLectureAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lectureId: string,
): Promise<AdminAssignment[]> {
  const { data: rows } = await supabase
    .from('assignments')
    .select(
      'id, code, type, title, description, instructions, points, due_date, sort_order, ' +
        'assignment_questions ( id, kind, question, options, correct_index, position )',
    )
    .eq('lecture_id', lectureId)
    .order('sort_order', { ascending: true })

  return (rows ?? []).map((a: any) => ({
    id: a.id,
    code: a.code,
    type: (a.type === 'اختبار' ? 'اختبار' : 'تسليم') as AdminAssignment['type'],
    title: a.title,
    description: a.description ?? '',
    instructions: (a.instructions as string[]) ?? [],
    points: a.points ?? 0,
    dueDate: a.due_date ?? null,
    sortOrder: a.sort_order ?? 0,
    questions: [...(a.assignment_questions ?? [])]
      .sort((x: any, y: any) => (x.position ?? 0) - (y.position ?? 0))
      .map((q: any) => ({
        id: q.id,
        kind: (q.kind as QuestionKind) ?? 'mcq',
        question: q.question,
        options: (q.options as string[]) ?? [],
        correctIndex: q.correct_index ?? 0,
      })),
  }))
}

function assignmentCode() {
  return `ASG-LEC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

// Replaces all questions of an assignment with the provided set.
async function replaceAssignmentQuestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  questions: AdminAssignmentQuestion[],
) {
  await supabase
    .from('assignment_questions')
    .delete()
    .eq('assignment_id', assignmentId)

  if (questions.length === 0) return null

  const rows = questions.map((q, i) => ({
    assignment_id: assignmentId,
    kind: q.kind,
    question: q.question,
    options: q.kind === 'mcq' ? q.options : [],
    correct_index: q.kind === 'mcq' ? q.correctIndex : 0,
    position: i + 1,
  }))
  const { error } = await supabase.from('assignment_questions').insert(rows)
  return error
}

export async function createAssignment(lectureId: string, input: AssignmentInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const sortOrder = await nextContentOrder(supabase, lectureId)

  const { data, error } = await supabase
    .from('assignments')
    .insert({
      code: assignmentCode(),
      lecture_id: lectureId,
      type: input.type ?? 'تسليم',
      title: input.title,
      description: input.description,
      instructions: [],
      points: input.points,
      due_date: input.dueDate || null,
      sort_order: sortOrder,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.log('[v0] createAssignment error:', error?.message)
    return { error: 'تعذّر إنشاء الواجب.' }
  }

  const qErr = await replaceAssignmentQuestions(supabase, data.id, input.questions)
  if (qErr) {
    console.log('[v0] createAssignment questions error:', qErr.message)
    return { error: 'تعذّر حفظ أسئلة الواجب.' }
  }

  logActivity({ action: 'create', resource: 'courses', targetLabel: `واجب: ${input.title}` }).catch(() => {})
  revalidatePath(`/admin/courses/${lectureId}`)
  revalidatePath('/courses')
  revalidatePath('/student')
  return { success: true }
}

export async function updateAssignment(id: string, input: AssignmentInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase
    .from('assignments')
    .update({
      type: input.type ?? 'تسليم',
      title: input.title,
      description: input.description,
      points: input.points,
      due_date: input.dueDate || null,
    })
    .eq('id', id)

  if (error) {
    console.log('[v0] updateAssignment error:', error.message)
    return { error: 'تعذّر تحديث الواجب.' }
  }

  const qErr = await replaceAssignmentQuestions(supabase, id, input.questions)
  if (qErr) {
    console.log('[v0] updateAssignment questions error:', qErr.message)
    return { error: 'تعذّر حفظ أسئلة الواجب.' }
  }

  logActivity({ action: 'update', resource: 'courses', targetId: id, targetLabel: `واجب: ${input.title}` }).catch(() => {})
  revalidatePath('/admin/courses')
  revalidatePath('/courses')
  revalidatePath('/student')
  return { success: true }
}

export async function deleteAssignment(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  await supabase.from('assignment_questions').delete().eq('assignment_id', id)
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) {
    console.log('[v0] deleteAssignment error:', error.message)
    return { error: 'تعذّر حذف الواجب.' }
  }
  logActivity({ action: 'delete', resource: 'courses', targetId: id, targetLabel: `واجب ID: ${id}` }).catch(() => {})
  revalidatePath('/courses')
  revalidatePath('/student')
  return { success: true }
}

// Reorders a lecture's mixed content (lessons + assignments) into one list.
// `items` is the new order; sort_order is assigned 1..n across both tables.
export async function reorderLectureContent(
  lectureId: string,
  items: { kind: 'lesson' | 'assignment'; id: string }[],
) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'courses', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const updates = items.map((item, i) => {
    const table = item.kind === 'lesson' ? 'lessons' : 'assignments'
    return supabase
      .from(table)
      .update({ sort_order: i + 1 })
      .eq('id', item.id)
      .eq('lecture_id', lectureId)
  })

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) {
    console.log('[v0] reorderLectureContent error:', failed.error.message)
    return { error: 'تعذّر إعادة الترتيب.' }
  }

  revalidatePath(`/admin/courses/${lectureId}`)
  revalidatePath('/courses')
  return { success: true }
}
