'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStudent } from '@/lib/auth-guard'
import { getPurchasedCourses } from '@/lib/student-lectures-data'
import type { Invoice, InvoiceStatus, PaymentMethod } from '@/lib/student-billing-data'
import { formatRelativeArabic } from '@/lib/notifications-data'

// ── Billing ──────────────────────────────────────────────────────

// Maps an order's status to the student-facing invoice status.
function mapOrderStatus(status: string): InvoiceStatus {
  switch (status) {
    case 'approved':
      return 'مدفوعة'
    case 'rejected':
      return 'مرفوضة'
    default:
      return 'قيد المراجعة'
  }
}

function formatPaymentDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return date
  }
}

type OrderRow = {
  code: string
  method: string | null
  reference: string | null
  note: string | null
  total: number
  status: string
  created_at: string
  order_items: { lecture_title: string | null }[] | null
}

const asPaymentMethod = (m: string | null): PaymentMethod | undefined =>
  m === 'انستاباي' || m === 'فودافون كاش' ? m : undefined

// Returns the current student's real purchases (the `orders` created at
// checkout) mapped to the Invoice shape used by the billing UI. This is the
// same data the admin approves under /admin/payments, so an approved order
// shows here as "مدفوعة". (The legacy `payments` table is seed-only and is no
// longer the source of truth for what a student actually bought.)
export async function getStudentInvoices(): Promise<Invoice[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: orderRows, error } = await supabase
    .from('orders')
    .select(
      'code, method, reference, note, total, status, created_at, order_items(lecture_title)',
    )
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  if (error) console.log('[v0] getStudentInvoices orders error:', error.message)

  return ((orderRows ?? []) as OrderRow[]).map((row) => {
    const titles = (row.order_items ?? [])
      .map((i) => i.lecture_title)
      .filter((t): t is string => !!t)
    const course =
      titles.length === 0
        ? 'طلب شراء'
        : titles.length === 1
          ? titles[0]
          : `${titles[0]} +${titles.length - 1} كورس`

    return {
      id: row.code,
      course,
      instructor: '',
      amount: Number(row.total) || 0,
      issuedAt: formatPaymentDate(row.created_at),
      dueDate: formatPaymentDate(row.created_at),
      status: mapOrderStatus(row.status),
      method: asPaymentMethod(row.method),
      reference: row.reference || undefined,
      submittedAt:
        row.status === 'pending' ? formatPaymentDate(row.created_at) : undefined,
      rejectionReason:
        row.status === 'rejected' ? row.note || undefined : undefined,
    }
  })
}

// Resubmits payment proof for one of the student's own orders (e.g. after
// rejection). Scoped to the current auth user so a student can only touch their
// own orders. Sets the order back to pending for admin re-review.
export async function resubmitPayment(
  code: string,
  method: PaymentMethod,
  reference: string,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'غير مسجّل الدخول.' }

  const { error } = await supabase
    .from('orders')
    .update({ method, reference, status: 'pending' })
    .eq('code', code)
    .eq('student_id', user.id)

  if (error) {
    console.log('[v0] resubmitPayment error:', error.message)
    return { error: 'تعذّر إرسال طلب الدفع. حاول تاني.' }
  }

  revalidatePath('/student/billing')
  return { success: true }
}

// ── Portal data ──────────────────────────────────────────────────
// (updateStudentProfile lives further down, near the other profile helpers.)



// The student's courses are the lectures they purchased (approved orders),
// drawn from the same public catalog shown on the landing page. This keeps the
// "كورساتي" view in sync with what's actually for sale and bought.
export async function getStudentEnrolledCourses() {
  const courses = await getPurchasedCourses()
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    image: c.image,
    category: c.category,
    completedLessons: c.completedLessons,
    totalLessons: c.totalLessons,
    nextLesson: c.nextLesson,
    rating: c.rating,
    durationHours: c.durationHours,
  }))
}

export async function unenrollCourse(courseSlug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'غير مسجّل الدخول.' }

  const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).single()
  if (!student) return { error: 'حساب الطالب غير موجود.' }

  const { data: lecture } = await supabase.from('lectures').select('id').eq('slug', courseSlug).single()
  if (!lecture) return { error: 'الكورس غير موجود.' }

  const { data: orders } = await supabase.from('orders').select('id').eq('student_id', user.id)
  const orderIds = orders?.map((o: any) => o.id) || []

  if (orderIds.length > 0) {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('lecture_id', lecture.id)
      .in('order_id', orderIds)

    if (error) {
      console.error('[v0] unenrollCourse error:', error.message)
      return { error: 'حدث خطأ أثناء إلغاء الاشتراك. حاول مرة أخرى.' }
    }
  }

  revalidatePath('/student/courses')
  revalidatePath('/student')
  return { success: true }
}

// Cancels a monthly-course bundle subscription by removing its order_items
// (the single `course_bundle` row) from the student's orders.
export async function unenrollMonthlyCourse(courseDbId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'غير مسجّل الدخول.' }

  const { data: orders } = await supabase.from('orders').select('id').eq('student_id', user.id)
  const orderIds = orders?.map((o: any) => o.id) || []

  if (orderIds.length > 0) {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('monthly_course_id', courseDbId)
      .in('order_id', orderIds)

    if (error) {
      console.error('[v0] unenrollMonthlyCourse error:', error.message)
      return { error: 'حدث خطأ أثناء إلغاء الاشتراك. حاول مرة أخرى.' }
    }
  }

  revalidatePath('/student/courses')
  revalidatePath('/student')
  return { success: true }
}

// Helper to build targeted calendar query filters for a student
async function getStudentCalendarFilters(supabase: any, student: any) {
  // 1. Get student profile for grade
  const { data: profile } = await supabase.from('profiles').select('grade').eq('id', student.user_id).single()
  const gradeSlug = profile?.grade

  // 2. Get stage_id for that grade
  let stageId = null
  if (gradeSlug) {
    const { data: stage } = await supabase.from('stages').select('id').eq('slug', gradeSlug).single()
    stageId = stage?.id
  }

  // 3. Get enrollments
  const { data: enrollments } = await supabase.from('enrollments').select('course_id').eq('student_id', student.id)
  const lectureIds = enrollments?.map((e: any) => e.course_id) || []

  // 4. Get branches from those lectures
  let branchIds: string[] = []
  if (lectureIds.length > 0) {
    const { data: lectures } = await supabase.from('lectures').select('branch_id').in('id', lectureIds)
    branchIds = Array.from(new Set(lectures?.map((l: any) => l.branch_id) || []))
  }

  let stageFilter = `stage_id.is.null`
  if (stageId) stageFilter += `,stage_id.eq.${stageId}`

  let branchFilter = `branch_id.is.null`
  if (branchIds.length > 0) branchFilter += `,branch_id.in.(${branchIds.join(',')})`

  let lectureFilter = `lecture_id.is.null`
  if (lectureIds.length > 0) lectureFilter += `,lecture_id.in.(${lectureIds.join(',')})`

  return { stageFilter, branchFilter, lectureFilter }
}

export async function getStudentUpcomingSchedule() {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return []

  const filters = await getStudentCalendarFilters(supabase, student)
  
  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .or(filters.stageFilter)
    .or(filters.branchFilter)
    .or(filters.lectureFilter)
    .gte('event_date', new Date().toISOString().split('T')[0])
    .order('event_date', { ascending: true })
    .limit(5)

  if (!events) return []

  return events.map((e: any) => {
    return {
      id: e.code,
      title: e.title,
      course: e.course || 'عام',
      type: e.type,
      day: new Date(e.event_date).toLocaleDateString('ar-EG', { weekday: 'long' }),
      date: new Date(e.event_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }),
      time: e.event_time,
    }
  })
}

export async function getStudentFullSchedule() {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return []

  // Filter by enrolled courses and stage
  const filters = await getStudentCalendarFilters(supabase, student)
  
  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .or(filters.stageFilter)
    .or(filters.branchFilter)
    .or(filters.lectureFilter)
    .order('event_date', { ascending: true })

  if (!events) return []

  return events.map((e: any) => {
    return {
      id: e.id,
      title: e.title,
      date: e.event_date,
      time: e.event_time,
      type: e.type,
      course: e.course || 'عام',
      description: e.description || '',
    }
  })
}

export async function getStudentRecentGrades() {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return []

  // Fetch graded assignment submissions first.
  const { data: asgSubs } = await supabase
    .from('assignment_submissions')
    .select('id, score, submitted_at, assignments(title, points, lecture_id, lectures:lecture_id(title))')
    .eq('student_id', student.id)
    .eq('status', 'مصحّح')
    .order('submitted_at', { ascending: false })
    .limit(5)

  // Fetch graded exam submissions too.
  const { data: examSubs } = await supabase
    .from('exam_submissions')
    .select('id, score, total, submitted_at, grading_status, exams(title, course)')
    .eq('student_id', student.id)
    .eq('grading_status', 'graded')
    .order('submitted_at', { ascending: false })
    .limit(5)

  const grades: import('@/lib/student-types').GradeItem[] = []

  for (const s of asgSubs ?? []) {
    const asg = s.assignments as any
    grades.push({
      id: s.id,
      title: asg?.title ?? '—',
      course: (asg?.lectures as any)?.title ?? 'عام',
      score: s.score ?? 0,
      total: asg?.points ?? 0,
      date: s.submitted_at
        ? new Date(s.submitted_at).toLocaleDateString('ar-EG')
        : '',
    })
  }

  for (const s of examSubs ?? []) {
    const ex = s.exams as any
    grades.push({
      id: s.id,
      title: ex?.title ?? '—',
      course: ex?.course ?? 'عام',
      score: s.score ?? 0,
      total: (s as any).total ?? 0,
      date: s.submitted_at
        ? new Date(s.submitted_at).toLocaleDateString('ar-EG')
        : '',
    })
  }

  // Sort merged list by recency, keep top 5.
  return grades
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 5)
}

export async function getStudentCertificates() {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return []

  const { data: certs } = await supabase
    .from('certificates')
    .select('*')
    .eq('student_id', student.id)
    .order('issued_at', { ascending: false })

  if (!certs) return []
  return certs.map((c: any) => {
    return {
      id: c.id,
      title: c.title,
      issuer: c.issuer,
      date: new Date(c.issued_at).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })
    }
  })
}

// Builds the student's targeting context (stage + enrolled branches + lectures).
// Shared between getStudentAnnouncements and getStudentNotifications.
async function getStudentTargeting(supabase: any, student: any) {
  const stageId: string | null = student.stage_id ?? null

  // Source 1: lecture IDs from enrollments (legacy path)
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', student.id)
  const enrolledLectureIds: string[] = (enrollments ?? []).map((e: any) => e.course_id)

  // Source 2: lecture IDs from approved orders (primary purchase path)
  let orderedLectureIds: string[] = []
  if (student.user_id) {
    const { data: orderItems } = await supabase
      .from('orders')
      .select('order_items(lecture_id)')
      .eq('student_id', student.user_id)
      .eq('status', 'approved')
    orderedLectureIds = (orderItems ?? [])
      .flatMap((o: any) => (o.order_items ?? []).map((i: any) => i.lecture_id))
      .filter(Boolean)
  }

  // Merge both sources
  const lectureIds: string[] = Array.from(new Set([...enrolledLectureIds, ...orderedLectureIds]))

  let branchIds: string[] = []
  if (lectureIds.length > 0) {
    const { data: lectures } = await supabase
      .from('lectures')
      .select('branch_id')
      .in('id', lectureIds)
    branchIds = Array.from(
      new Set((lectures ?? []).map((l: any) => l.branch_id).filter(Boolean)),
    )
  }

  return { stageId, lectureIds, branchIds }
}

// Filters a list of raw notification rows to only those visible to this student
// based on the quadruple targeting (student / stage / branch / lecture).
function filterByTargeting(
  notifs: any[],
  studentId: string,
  stageId: string | null,
  lectureIds: string[],
  branchIds: string[],
) {
  const lectureSet = new Set(lectureIds)
  const branchSet = new Set(branchIds)

  return notifs.filter((n: any) => {
    if (n.student_id && n.student_id === studentId) return true
    if (n.student_id) return false

    const hasTargeting = n.stage_id || n.branch_id || n.lecture_id
    if (!hasTargeting) return true

    if (n.lecture_id && lectureSet.has(n.lecture_id)) return true
    if (n.branch_id && branchSet.has(n.branch_id)) return true
    if (n.stage_id && stageId && n.stage_id === stageId) return true
    return false
  })
}

export async function getStudentAnnouncements() {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return []

  const { stageId, lectureIds, branchIds } = await getStudentTargeting(supabase, student)

  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .or(`student_id.eq.${student.id},student_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!notifs) return []

  const visible = filterByTargeting(notifs, student.id, stageId, lectureIds, branchIds)

  return visible.slice(0, 5).map((n: any) => ({
    id: n.code ?? n.id,
    title: n.title,
    text: n.description,
    time: formatRelativeArabic(n.created_at),
    course: 'منصة',
  }))
}

// Maps an admin-side notification type to the student-facing notification type.
function mapNotifType(type: string): 'lesson' | 'exam' | 'assignment' | 'grade' | 'message' | 'system' {
  switch (type) {
    case 'كورس':
      return 'lesson'
    case 'اختبار':
      return 'exam'
    case 'رسالة':
      return 'message'
    case 'طالب':
      return 'system'
    default:
      return 'system'
  }
}

// Returns the full notification feed for the current student: their own
// notifications, global broadcasts, and notifications targeted at their
// stage/branch/lecture. Read state comes from notification_reads.
export async function getStudentNotifications() {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return []

  const { stageId, lectureIds, branchIds } = await getStudentTargeting(supabase, student)

  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .or(`student_id.eq.${student.id},student_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = filterByTargeting(
    notifs ?? [],
    student.id,
    stageId,
    lectureIds,
    branchIds,
  )

  // Read state from notification_reads.
  let readIds = new Set<string>()
  const { data: reads } = await supabase
    .from('notification_reads')
    .select('notification_id')
    .eq('student_id', student.id)
  if (reads) readIds = new Set(reads.map((r: any) => r.notification_id))

  rows.sort(
    (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return rows.map((n: any) => ({
    id: n.code ?? n.id,
    notifId: n.id,
    type: mapNotifType(n.type),
    title: n.title,
    text: n.description,
    time: formatRelativeArabic(n.created_at),
    read: readIds.has(n.id),
  }))
}

// Marks a single notification as read for the current student.
export async function markStudentNotificationRead(notifId: string) {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return { error: 'لازم تسجّل دخول.' }

  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      { notification_id: notifId, student_id: student.id },
      { onConflict: 'notification_id,student_id' },
    )
  if (error) return { error: error.message }
  revalidatePath('/student/notifications')
  return { success: true }
}

// Marks every currently-visible notification as read for the student.
export async function markAllStudentNotificationsRead(notifIds: string[]) {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return { error: 'لازم تسجّل دخول.' }
  if (notifIds.length === 0) return { success: true }

  const { error } = await supabase.from('notification_reads').upsert(
    notifIds.map((id) => ({ notification_id: id, student_id: student.id })),
    { onConflict: 'notification_id,student_id' },
  )
  if (error) return { error: error.message }
  revalidatePath('/student/notifications')
  return { success: true }
}

export async function getStudentExams() {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return []

  // Step 1: resolve the student's enrolled branch IDs via their stage.
  // exams.branch_id targets a specific branch; null means broadcast to all.
  const { stageId, branchIds } = await getStudentTargeting(supabase, student)

  // Step 2: fetch published exams that are either broadcast (branch_id IS NULL)
  // or specifically aimed at one of the student's enrolled branches.
  let query = supabase
    .from('exams')
    .select('id, code, title, course, duration, pass_mark, questions, status, created_at, branch_id')
    .eq('status', 'منشور')
    .order('created_at', { ascending: false })

  if (branchIds.length > 0) {
    // Show exams with no branch (broadcast) OR aimed at one of their branches.
    query = query.or(
      `branch_id.is.null,branch_id.in.(${branchIds.join(',')})`,
    )
  } else {
    // Student has no enrolled courses yet — show only broadcast exams.
    query = query.is('branch_id', null)
  }

  const { data: exams } = await query
  if (!exams || exams.length === 0) return []
  const examIds = exams.map((e: any) => e.id)

  // Step 3: fetch this student's own submissions for the visible exams.
  const { data: submissions } = await supabase
    .from('exam_submissions')
    .select('exam_id, score, total, status, grading_status, submitted_at')
    .eq('student_id', student.id)
    .in('exam_id', examIds)

  return exams.map((e: any) => {
    const sub = submissions?.find((s: any) => s.exam_id === e.id)
    const pending = sub?.grading_status === 'pending'
    const graded = sub && sub.grading_status === 'graded'

    // Derive the list-view status: مكتمل once submitted, متاح otherwise.
    const status: 'متاح' | 'مكتمل' = sub ? 'مكتمل' : 'متاح'

    // totalPoints: use the stored submission total when available, otherwise
    // fall back to 0 (we can't compute it without fetching all questions here).
    const totalPoints = sub?.total ?? 0

    return {
      id: e.code,
      title: e.title,
      course: e.course || 'عام',
      category: 'اختبار',
      status,
      pending,
      // questionsCount is the integer column — used directly in the card UI.
      questionsCount: e.questions ?? 0,
      durationMinutes: e.duration || 30,
      totalPoints,
      passingPercent: e.pass_mark ?? 50,
      // Only expose a score once auto-grading (or manual grading) is done.
      score: graded ? (sub.score ?? 0) : null,
      date: pending
        ? 'قيد التصحيح'
        : sub
          ? 'تم التسليم'
          : 'متاح الآن',
      time: '—',
    }
  })
}

export async function getStudentAssignments() {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return []

  // Step 1: get lecture IDs the student is enrolled in.
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', student.id)

  if (!enrollments || enrollments.length === 0) return []
  const lectureIds = enrollments.map((e: any) => e.course_id)

  // Step 2: fetch all assignments for those lectures (all types).
  const { data: rows } = await supabase
    .from('assignments')
    .select('id, code, title, type, due_date, points, description, instructions, lecture_id, lectures:lecture_id(title)')
    .in('lecture_id', lectureIds)
    .order('due_date', { ascending: true })

  if (!rows || rows.length === 0) return []
  const assignmentIds = rows.map((a: any) => a.id)

  // Step 3: fetch this student's submissions for those assignments.
  const { data: submissions } = await supabase
    .from('assignment_submissions')
    .select('assignment_id, status, score, submitted_at')
    .eq('student_id', student.id)
    .in('assignment_id', assignmentIds)

  const subMap = new Map(
    (submissions ?? []).map((s: any) => [s.assignment_id, s]),
  )

  return rows.map((a: any) => {
    const sub = subMap.get(a.id)
    const dueDate = a.due_date
      ? new Date(a.due_date).toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—'

    const rawStatus = sub?.status
    const status: import('@/lib/student-types').AssignmentStatus =
      rawStatus === 'مصحّح' || rawStatus === 'graded' || rawStatus === 'مصحح'
        ? 'مصحّح'
        : rawStatus === 'تم التسليم' || rawStatus === 'submitted'
          ? 'تم التسليم'
          : rawStatus === 'قيد التنفيذ' || rawStatus === 'pending'
            ? 'قيد التنفيذ'
            : 'لم يبدأ'

    return {
      id: a.code ?? a.id,
      courseId: a.lecture_id,
      title: a.title,
      type: (a.type === 'اختبار' ? 'اختبار' : 'تسليم') as 'اختبار' | 'تسليم',
      description: a.description ?? '',
      instructions: a.instructions ?? [],
      dueDate,
      points: a.points ?? 10,
      score: sub?.score ?? null,
      status,
      attachments: [] as { name: string; size: string }[],
      // lectureTitle for display in the card (no courseId in this table)
      lectureTitle: (a.lectures as any)?.title ?? '',
    }
  })
}



export async function getAvailableStagesMinimal() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stages')
    .select('id, slug, title')
    .order('sort_order', { ascending: true })

  return data || []
}

export async function setStudentGrade(grade: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'لازم تسجّل دخول.' }

  const { error } = await supabase
    .from('profiles')
    .update({ grade })
    .eq('id', user.id)

  if (error) return { error: error.message }

  // Update students table as well if necessary, but typically grade is in profiles or both
  // Here we update profiles.
  
  revalidatePath('/student', 'layout')
  return { success: true }
}



// Returns learning activity for the current student over the specified number of days.
// Days with no recorded activity are filled in with 0 hours so the chart
// always shows a complete window.
export async function getStudentLearningActivity(days: number = 7) {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return buildEmptyDays(days)

  const { data: rows } = await supabase
    .from('learning_activity')
    .select('activity_date, minutes')
    .eq('student_id', student.id)
    .gte(
      'activity_date',
      new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    )
    .order('activity_date', { ascending: true })

  // Build a map of date → minutes for fast lookup.
  const minutesByDate = new Map<string, number>(
    (rows ?? []).map((r: any) => [r.activity_date as string, r.minutes as number]),
  )

  return buildEmptyDays(days).map((day) => ({
    ...day,
    hours: parseFloat(
      ((minutesByDate.get(day.isoDate) ?? 0) / 60).toFixed(1),
    ),
  }))
}

/** Generates an array of the last N days in {day, isoDate, hours} format. */
function buildEmptyDays(days: number) {
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - ((days - 1) - i) * 24 * 60 * 60 * 1000)
    return {
      day: dayNames[d.getDay()],
      isoDate: d.toISOString().split('T')[0],
      hours: 0,
    }
  })
}

// ── Profile ───────────────────────────────────────────────────────────────────

// Returns the current student's profile combining profiles + students + stage.
export async function getStudentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: student }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, phone, avatar_url, color_preset, notif_prefs, grade')
      .eq('id', user.id)
      .single(),
    supabase
      .from('students')
      .select('id, code, name, phone, avatar, stage_id, status, joined_at, stages:stage_id(title)')
      .eq('user_id', user.id)
      .single(),
  ])

  if (!profile && !student) return null

  const displayName = student?.name || profile?.full_name || ''
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()

  const stageRow = student?.stages as any
  const stageTitle = stageRow?.title ?? profile?.grade ?? ''

  return {
    name: displayName,
    email: user.email ?? profile?.email ?? '',
    phone: student?.phone || profile?.phone || '',
    avatarUrl: student?.avatar || profile?.avatar_url || null,
    initials,
    level: stageTitle,
    stageTitle,
    status: student?.status ?? 'نشط',
    joinedAt: student?.joined_at ?? null,
    code: student?.code ?? '',
    colorPreset: profile?.color_preset ?? 'navy',
    notifPrefs: (profile?.notif_prefs as Record<string, boolean>) ?? {},
  }
}

// Updates profile fields in both `profiles` and `students` tables atomically.
// `avatarUrl` is the public URL of the file already uploaded to Supabase Storage.
export async function updateStudentProfile({
  fullName,
  phone,
  avatarUrl,
}: {
  fullName: string
  phone?: string
  avatarUrl?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'يجب تسجيل الدخول.' }

  const trimmedName = fullName.trim()
  if (!trimmedName) return { error: 'الاسم مطلوب.' }

  // Build patch objects — only include avatarUrl if explicitly passed.
  const profilePatch: Record<string, string> = {
    full_name: trimmedName,
    ...(phone !== undefined && { phone: phone.trim() }),
    ...(avatarUrl !== undefined && avatarUrl !== null && { avatar_url: avatarUrl }),
  }
  const studentPatch: Record<string, string> = {
    name: trimmedName,
    ...(phone !== undefined && { phone: phone.trim() }),
    ...(avatarUrl !== undefined && avatarUrl !== null && { avatar: avatarUrl }),
  }

  const [profileRes, studentRes] = await Promise.all([
    supabase.from('profiles').update(profilePatch).eq('id', user.id),
    supabase
      .from('students')
      .update(studentPatch)
      .eq('user_id', user.id),
  ])

  if (profileRes.error) return { error: profileRes.error.message }
  if (studentRes.error) return { error: studentRes.error.message }

  revalidatePath('/student')
  revalidatePath('/student/settings')
  return { success: true }
}

// Saves theme preferences (color preset + notification toggles) to `profiles`.
export async function updateStudentPreferences(
  colorPreset: string,
  notifPrefs: Record<string, boolean>,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'يجب تسجيل الدخول.' }

  const { error } = await supabase
    .from('profiles')
    .update({ color_preset: colorPreset, notif_prefs: notifPrefs })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/student/settings')
  return { success: true }
}

export async function trackStudentDevice() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).single();
  if (!student) return;

  const { headers } = await import('next/headers');
  const hdrs = await headers();
  
  const ip = hdrs.get('x-real-ip') || hdrs.get('x-forwarded-for') || '127.0.0.1';
  const city = hdrs.get('x-vercel-ip-city') || 'القاهرة';
  const country = hdrs.get('x-vercel-ip-country') || 'مصر';
  const ua = hdrs.get('user-agent') || '';

  let browser = 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';

  let os = 'Windows';
  if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS';

  let deviceType = 'كمبيوتر مكتبي';
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) deviceType = 'موبايل';
  else if (ua.includes('iPad') || ua.includes('Tablet')) deviceType = 'تابلت';

  const { data: existing } = await supabase.from('student_devices').select('sessions').eq('student_id', student.id).single();
  const sessions = (existing?.sessions || 0) + 1;

  await supabase.from('student_devices').upsert({
    student_id: student.id,
    ip,
    city,
    country,
    browser,
    os,
    device_type: deviceType,
    last_active: new Date().toISOString(),
    sessions
  }, { onConflict: 'student_id' });

  // Also record this login day as an active learning day (0 minutes initially if not already set).
  const today = new Date().toISOString().split('T')[0];
  const { data: existingActivity } = await supabase
    .from('learning_activity')
    .select('minutes')
    .eq('student_id', student.id)
    .eq('activity_date', today)
    .single();

  if (!existingActivity) {
    await supabase.from('learning_activity').upsert({
      student_id: student.id,
      activity_date: today,
      minutes: 0
    }, { onConflict: 'student_id,activity_date' });
  }
}

// ── Monthly Progress ────────────────────────────────────────────────────────

export type MonthlyStat = {
  label: string
  value: string | number
  change: string
  positive: boolean | null
}

// Returns four real stats for the current calendar month:
// completed lessons, learning hours, current daily streak, average grade.
export async function getStudentMonthlyProgress(): Promise<MonthlyStat[]> {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  
  // Use admin client for fetching stats to avoid any RLS issues
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminDb = createAdminClient()

  const empty: MonthlyStat[] = [
    { label: 'درس مكتمل', value: 0, change: 'ابدأ التعلّم الآن', positive: null },
    { label: 'ساعة تعلّم', value: 0, change: 'ابدأ التعلّم الآن', positive: null },
    { label: 'يوم نشاط متتالي', value: 0, change: 'لا يوجد نشاط بعد', positive: null },
    { label: 'متوسط الدرجات', value: '—', change: 'لا توجد درجات بعد', positive: null },
  ]
  if (!student) return empty

  const now = new Date()
  const formatYMD = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStartDate = formatYMD(monthStart)
  const monthStartISO = monthStart.toISOString()

  // 1) Completed lessons this month (content progress uses user_id).
  const { count: lessonsCount1 } = await adminDb
    .from('student_content_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', student.user_id)
    .eq('item_type', 'lesson')
    .eq('status', 'completed')
    .gte('updated_at', monthStartISO)
    
  const { count: lessonsCount2 } = await adminDb
    .from('lesson_progress')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', student.user_id)
    .eq('completed', true)
    .gte('completed_at', monthStartISO)
    
  const lessonsCount = (lessonsCount1 || 0) + (lessonsCount2 || 0)

  // 2) Learning hours this month.
  const { data: monthActivity } = await adminDb
    .from('learning_activity')
    .select('activity_date, minutes')
    .eq('student_id', student.id)
    .gte('activity_date', monthStartDate)
  const totalMinutes = (monthActivity ?? []).reduce(
    (sum, r: any) => sum + (r.minutes ?? 0),
    0,
  )
  const hoursRaw = totalMinutes / 60
  const hours = hoursRaw > 0 && hoursRaw < 1 ? Number(hoursRaw.toFixed(1)) : Math.round(hoursRaw)

  // 3) Current consecutive-day streak (based on all activity days).
  const { data: allActivity } = await adminDb
    .from('learning_activity')
    .select('activity_date')
    .eq('student_id', student.id)
    .order('activity_date', { ascending: false })
  const activeDays = new Set(
    (allActivity ?? []).map((r: any) => r.activity_date as string),
  )
  let streak = 0
  const cursor = new Date()
  
  // If there's no activity today, start counting from yesterday so an
  // in-progress day doesn't reset the streak.
  if (!activeDays.has(formatYMD(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (activeDays.has(formatYMD(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  // 4) Average grade this month (assignments + exams, normalised to %).
  const { data: asgSubs } = await adminDb
    .from('assignment_submissions')
    .select('score, submitted_at, assignments(points)')
    .eq('student_id', student.id)
    .not('score', 'is', null)
    .gte('submitted_at', monthStartISO)
  const { data: examSubs } = await adminDb
    .from('exam_submissions')
    .select('score, total, submitted_at')
    .eq('student_id', student.id)
    .not('score', 'is', null)
    .gte('submitted_at', monthStartISO)

  const percentages: number[] = []
  for (const s of asgSubs ?? []) {
    const points = (s.assignments as any)?.points ?? 0
    if (points > 0 && s.score != null) percentages.push((s.score / points) * 100)
  }
  for (const s of examSubs ?? []) {
    const total = (s as any).total ?? 0
    if (total > 0 && s.score != null) percentages.push((s.score / total) * 100)
  }
  const avgGrade =
    percentages.length > 0
      ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
      : null

  return [
    {
      label: 'درس مكتمل',
      value: lessonsCount ?? 0,
      change: 'خلال هذا الشهر',
      positive: (lessonsCount ?? 0) > 0 ? true : null,
    },
    {
      label: 'ساعة تعلّم',
      value: hours,
      change: 'خلال هذا الشهر',
      positive: hours > 0 ? true : null,
    },
    {
      label: 'يوم نشاط متتالي',
      value: streak,
      change: streak > 0 ? 'استمر في التعلّم!' : 'لا يوجد نشاط بعد',
      positive: streak > 0 ? true : null,
    },
    {
      label: 'متوسط الدرجات',
      value: avgGrade != null ? `${avgGrade}%` : '—',
      change:
        avgGrade != null
          ? `عن ${percentages.length} تقييم هذا الشهر`
          : 'لا توجد درجات بعد',
      positive: avgGrade != null ? avgGrade >= 60 : null,
    },
  ]
}

