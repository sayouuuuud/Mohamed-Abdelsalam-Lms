'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import type { StudentProfile, DeviceInfo, EnrolledCourse, PaymentRecord, ExamGrade, AssignmentRecord, StudentStatus } from '@/lib/student-profile-data'

// ── Update student account status ─────────────────────────────────────────────
export async function updateStudentStatus(
  studentId: string,           // students.id (UUID)
  studentCode: string,         // students.code  (for revalidation)
  newStatus: StudentStatus,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    if (!(await hasResourceAccess(supabase, 'students', 'manage'))) {
      return { error: 'غير مسموح.' }
    }

    const adminDb = createAdminClient()

    // .select() ensures we detect the "0 rows matched" case — without it
    // Supabase returns success even when nothing was actually updated.
    const { data: updated, error } = await adminDb
      .from('students')
      .update({ status: newStatus })
      .eq('id', studentId)
      .select('id')

    if (error) return { error: error.message }
    if (!updated || updated.length === 0) {
      return { error: 'لم يتم العثور على الطالب في قاعدة البيانات.' }
    }

    logActivity({ action: 'update', resource: 'students', targetId: studentCode, targetLabel: `حالة طالب: ${newStatus}` }).catch(() => {})
    revalidatePath(`/admin/students/${studentCode}`)
    revalidatePath('/admin/students')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء تغيير الحالة.' }
  }
}

// ── Send a message / notification to a student ────────────────────────────────
export async function sendMessageToStudent(
  studentId: string,   // students.id (UUID)
  studentCode: string,
  studentName: string,
  subject: string,
  body: string,
  channel: 'رسالة داخلية' | 'إشعار',
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  if (!(await hasResourceAccess(supabase, 'students', 'manage'))) {
    return { error: 'غير مسموح.' }
  }

  const adminDb = createAdminClient()

  const timeLabel = new Date().toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (channel === 'إشعار') {
    // Insert into notifications table
    const code = `NOTIF-${Date.now()}`
    const { error } = await adminDb.from('notifications').insert({
      code,
      student_id: studentId,
      type: 'رسالة إدارية',
      title: subject || 'رسالة من الإدارة',
      description: body,
      time_label: timeLabel,
    })
    if (error) return { error: error.message }
  } else {
    // We need the student's user_id for the messages table!
    const { data: studentRow } = await adminDb
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .single()

    if (!studentRow?.user_id) {
      return { error: 'الطالب غير مرتبط بحساب مستخدم.' }
    }
    const studentUserId = studentRow.user_id

    // Insert or append into messages table
    // Check if an existing open thread exists for this student
    const { data: existing } = await adminDb
      .from('messages')
      .select('id, code, chat_history, student_unread')
      .eq('student_id', studentUserId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const newMsg = {
      id: `m${Date.now()}`,
      fromMe: true,
      text: body,
      time: 'الآن',
    }

    if (existing) {
      // Append to existing thread
      const history = (existing.chat_history as any[]) ?? []
      const { error } = await adminDb
        .from('messages')
        .update({
          chat_history: [...history, newMsg],
          content: body,
          time_label: timeLabel,
          student_unread: (existing.student_unread ?? 0) + 1,
        })
        .eq('id', existing.id)
      if (error) return { error: error.message }
    } else {
      // Create a new thread
      const code = `MSG-ADMIN-${Date.now()}`
      const { error } = await adminDb.from('messages').insert({
        code,
        student_id: studentUserId,
        sender_name: studentName,
        subject: subject || 'رسالة من الإدارة',
        content: body,
        time_label: timeLabel,
        unread_count: 0,
        student_unread: 1,
        is_read: true,
        sender_role: 'أدمن',
        chat_history: [newMsg],
        status: 'open',
      })
      if (error) return { error: error.message }
    }
  }

  logActivity({ action: 'create', resource: 'students', targetId: studentCode, targetLabel: `رسالة لـ ${studentName} (${channel})` }).catch(() => {})
  revalidatePath(`/admin/students/${studentCode}`)
  revalidatePath('/admin/messages')
  return { success: true }
}

function formatRelativeTime(date: string | Date): string {
  try {
    const d = new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'منذ لحظات';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `منذ ${diffInDays} يوم`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `منذ ${diffInMonths} شهر`;
    const diffInYears = Math.floor(diffInDays / 365);
    return `منذ ${diffInYears} سنة`;
  } catch {
    return 'غير معروف';
  }
}

function formatJoinedAt(date: string): string {
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

export async function getStudentProfileData(code: string): Promise<StudentProfile | null> {
  const supabase = await createClient()

  if (!(await hasResourceAccess(supabase, 'students'))) return null

  // 1. Fetch Student
  const { data: studentRow, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('code', code)
    .single()

  if (studentError || !studentRow) return null

  const studentId = studentRow.id
  // `courses` and `progress` will be overwritten below with real computed values.
  const student = {
    id: studentRow.code,
    name: studentRow.name,
    email: studentRow.email || '',
    phone: studentRow.phone || '',
    gender: studentRow.gender,
    avatar: studentRow.avatar || undefined,
    courses: 0,        // overwritten after courses fetch
    progress: 0,       // overwritten after progress fetch
    spent: studentRow.spent,
    status: studentRow.status,
    joinedAt: formatJoinedAt(studentRow.joined_at),
  }

  // 2. Fetch Device Info
  const { data: deviceRow } = await supabase
    .from('student_devices')
    .select('*')
    .eq('student_id', studentId)
    .single()

  const device: DeviceInfo = deviceRow
    ? {
        browser: deviceRow.browser,
        os: deviceRow.os,
        deviceType: deviceRow.device_type,
        ip: deviceRow.ip,
        city: deviceRow.city,
        country: deviceRow.country,
        lastActive: formatRelativeTime(deviceRow.last_active),
        sessions: deviceRow.sessions,
      }
    : {
        browser: 'غير معروف',
        os: 'غير معروف',
        deviceType: 'غير معروف',
        ip: 'غير معروف',
        city: 'غير معروف',
        country: 'غير معروف',
        lastActive: 'غير معروف',
        sessions: 0,
      }

  // 3. Fetch Courses & Progress via orders + order_items
  // The system uses lectures (not the legacy `courses` table) as the product
  // unit. Enrollments are NOT written on purchase — ownership lives in
  // approved orders. We fetch each purchased lecture, then its lesson progress
  // via student_content_progress (keyed by user_id + lesson_id).
  const { data: orderedItems } = await supabase
    .from('orders')
    .select(`
      created_at,
      status,
      order_items (
        lecture_id,
        lecture_title,
        branch_title,
        stage_title,
        lectures:lecture_id (
          id,
          title,
          lessons ( id )
        )
      )
    `)
    .eq('student_id', studentRow.user_id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  // Flatten to one row per lecture (deduplicate in case of duplicate orders).
  // Also collect lesson ids per lecture for accurate per-lecture progress.
  const seenLectureIds = new Set<string>()
  const lectureRows: Array<{
    lectureId: string
    title: string
    category: string
    purchasedAt: string
    lessonIds: string[]
  }> = []

  for (const order of orderedItems ?? []) {
    for (const item of (order.order_items as any[]) ?? []) {
      const lectureId: string = item.lecture_id
      if (!lectureId || seenLectureIds.has(lectureId)) continue
      seenLectureIds.add(lectureId)

      const lecObj = Array.isArray(item.lectures) ? item.lectures[0] : item.lectures
      const lessonIds: string[] = (lecObj?.lessons ?? []).map((l: any) => l.id).filter(Boolean)

      lectureRows.push({
        lectureId,
        title: item.lecture_title || lecObj?.title || 'محاضرة',
        category: item.branch_title || 'عام',
        purchasedAt: order.created_at,
        lessonIds,
      })
    }
  }

  const adminDb = createAdminClient()

  // Fetch all completed lesson/content progress for this student at once.
  const { data: progressRows } = await adminDb
    .from('student_content_progress')
    .select('item_id, updated_at')
    .eq('user_id', studentRow.user_id)
    .eq('item_type', 'lesson')
    .eq('status', 'completed')

  const { data: legacyProgress } = await adminDb
    .from('lesson_progress')
    .select('lesson_id, completed_at')
    .eq('student_id', studentRow.user_id)
    .eq('completed', true)

  // Build a set of completed lesson/content ids for fast lookup.
  const completedIds = new Set<string>([
    ...((progressRows ?? []).map((r: any) => r.item_id as string)),
    ...((legacyProgress ?? []).map((r: any) => r.lesson_id as string)),
  ])

  const courses: EnrolledCourse[] = lectureRows.map((lec) => {
    const totalLessons = lec.lessonIds.length
    const lessonsDone = lec.lessonIds.filter((id) => completedIds.has(id)).length
    const progress = totalLessons > 0 ? Math.round((lessonsDone / totalLessons) * 100) : 0

    // Last accessed = latest completed_at for a lesson in this lecture.
    let lastAccessedDate = lec.purchasedAt
    for (const row of [...(progressRows ?? []).map((r: any) => ({ ...r, completed_at: r.updated_at })), ...(legacyProgress ?? [])] as any[]) {
      const id = row.item_id ?? row.lesson_id
      if (lec.lessonIds.includes(id) && row.completed_at) {
        if (new Date(row.completed_at) > new Date(lastAccessedDate)) {
          lastAccessedDate = row.completed_at
        }
      }
    }

    return {
      id: lec.lectureId,
      name: lec.title,
      category: lec.category,
      progress,
      lessonsDone,
      lessonsTotal: totalLessons,
      lastAccessed: formatRelativeTime(lastAccessedDate),
      status: progress >= 100 ? 'مكتمل' : progress === 0 ? 'متوقف' : 'قيد التقدم',
    }
  })

  // Back-fill the summary stats with real computed values.
  student.courses = courses.length
  student.progress = courses.length > 0
    ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length)
    : 0

  // 4. Fetch Payments from orders (matched by student.user_id = orders.student_id)
  const { data: ordersData } = await supabase
    .from('orders')
    .select(`
      id,
      code,
      total,
      subtotal,
      discount,
      method,
      status,
      created_at,
      coupon_code,
      order_items (
        lecture_title,
        branch_title,
        stage_title,
        price
      )
    `)
    .eq('student_id', studentRow.user_id)
    .order('created_at', { ascending: false })

  const payments: PaymentRecord[] = (ordersData || []).map((o: any) => {
    const items: string[] = (o.order_items || []).map((i: any) => i.lecture_title).filter(Boolean)
    const itemLabel = items.length > 0 ? items.join('، ') : 'طلب'
    return {
      id: o.code || o.id,
      date: formatJoinedAt(o.created_at),
      item: itemLabel,
      amount: Number(o.total),
      method: o.method as PaymentRecord['method'],
      status: o.status === 'approved' ? 'ناجح' : o.status === 'rejected' ? 'مسترد' : 'معلّق',
    }
  })

  const totalSpent = payments.reduce((acc, p) => p.status === 'ناجح' ? acc + p.amount : acc, 0)

  // 5. Fetch Exams
  const { data: examsData } = await supabase
    .from('exam_submissions')
    .select(`
      id,
      score,
      total,
      status,
      submitted_at,
      exams (
        title,
        course
      )
    `)
    .eq('student_id', studentId)

  const exams: ExamGrade[] = (examsData || []).map((e: any) => ({
    id: e.id,
    name: e.exams?.title || 'امتحان',
    course: e.exams?.course || 'كورس',
    score: e.score,
    total: e.total,
    date: formatJoinedAt(e.submitted_at),
    status: e.status as ExamGrade['status'],
  }))

  // 6. Fetch Assignments
  const { data: assignmentsData } = await supabase
    .from('assignment_submissions')
    .select(`
      id,
      status,
      score,
      submitted_at,
      assignments (
        title,
        due_date,
        courses (title)
      )
    `)
    .eq('student_id', studentId)

  const assignments: AssignmentRecord[] = (assignmentsData || []).map((a: any) => {
    // A row in assignment_submissions means the student did submit.
    // Only an explicit "متأخر" status marks it late; everything else is submitted.
    let status: AssignmentRecord['status'] = 'تم التسليم'
    if (a.status === 'متأخر') status = 'متأخر'
    else if (a.status === 'لم يسلّم') status = 'لم يسلّم'

    return {
      id: a.id,
      name: a.assignments?.title || 'واجب',
      course: a.assignments?.courses?.title || 'كورس',
      dueDate: formatJoinedAt(a.assignments?.due_date || a.submitted_at || new Date().toISOString()),
      status,
      grade: a.score,
    }
  })

  // 7. Dashboard Analytics computed from real data (last 6 months).
  const arMonths = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]
  const now = new Date()
  // Build the last 6 month buckets (oldest → newest).
  const monthBuckets = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: arMonths[d.getMonth()] }
  })

  // Total lessons across all enrolled courses (for progress %).
  const totalLessonsAll = courses.reduce((sum, c) => sum + c.lessonsTotal, 0)

  // Flatten all completed lesson/content progress entries with a completion date.
  const completedLessons: Date[] = [
    ...((progressRows ?? []).filter((r: any) => r.updated_at).map((r: any) => new Date(r.updated_at))),
    ...((legacyProgress ?? []).filter((r: any) => r.completed_at).map((r: any) => new Date(r.completed_at))),
  ]

  // Cumulative progress % at the end of each month bucket.
  const progressTrend = monthBuckets.map((b) => {
    const endOfMonth = new Date(b.year, b.month + 1, 0, 23, 59, 59)
    const doneByThen = completedLessons.filter((d) => d <= endOfMonth).length
    const progress =
      totalLessonsAll > 0 ? Math.round((doneByThen / totalLessonsAll) * 100) : 0
    return { month: b.label, progress }
  })

  // Real monthly spend from accepted orders.
  const monthlySpend = monthBuckets.map((b) => {
    const amount = (ordersData || [])
      .filter((o: any) => o.status === 'approved' && o.created_at)
      .filter((o: any) => {
        const d = new Date(o.created_at)
        return d.getFullYear() === b.year && d.getMonth() === b.month
      })
      .reduce((sum: number, o: any) => sum + Number(o.total), 0)
    return { month: b.label, amount }
  })

  // 7. Skills = comparison across the branches of the student's academic year.
  // For each branch we combine the student's average exam percentage with the
  // average progress in that branch's courses.
  let stageTitle = ''
  let skills: StudentProfile['skills'] = []

  if (studentRow.stage_id) {
    const { data: stageRow } = await supabase
      .from('stages')
      .select('title')
      .eq('id', studentRow.stage_id)
      .single()
    stageTitle = stageRow?.title || ''

    const { data: branchRows } = await supabase
      .from('branches')
      .select('id, title, sort_order')
      .eq('stage_id', studentRow.stage_id)
      .order('sort_order', { ascending: true })

    if (branchRows && branchRows.length > 0) {
      // Exam submissions joined to their exam's branch.
      const { data: branchExams } = await supabase
        .from('exam_submissions')
        .select('score, total, grading_status, exams!inner (branch_id)')
        .eq('student_id', studentId)

      // Student's enrollments joined to each course's branch.
      const { data: branchEnrollments } = await supabase
        .from('enrollments')
        .select('id, courses!inner (id, branch_id)')
        .eq('student_id', studentId)

      // Build a map: course_id -> progress (already computed from lesson_progress in section 3)
      const courseProgressMap = new Map(courses.map((c) => [c.id, c.progress]))

      const allBranchSkills = branchRows.map((branch: any) => {
        // Average exam percentage for this branch (graded submissions only).
        const branchSubs = (branchExams || []).filter(
          (s: any) =>
            s.exams?.branch_id === branch.id &&
            (s.grading_status ?? 'graded') === 'graded' &&
            s.total > 0,
        )
        const examAvg =
          branchSubs.length > 0
            ? Math.round(
                branchSubs.reduce(
                  (sum: number, s: any) => sum + (s.score / s.total) * 100,
                  0,
                ) / branchSubs.length,
              )
            : 0

        // Average course progress for this branch (from already-computed lesson_progress).
        const branchCourses = (branchEnrollments || []).filter(
          (e: any) => e.courses?.branch_id === branch.id,
        )
        const courseProgress =
          branchCourses.length > 0
            ? Math.round(
                branchCourses.reduce((sum: number, e: any) => {
                  const pct = courseProgressMap.get(e.courses?.id) ?? 0
                  return sum + pct
                }, 0) / branchCourses.length,
              )
            : 0

        // Combined score: average of both metrics, or whichever exists.
        const parts: number[] = []
        if (branchSubs.length > 0) parts.push(examAvg)
        if (branchCourses.length > 0) parts.push(courseProgress)
        const score =
          parts.length > 0
            ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
            : 0

        return {
          subject: branch.title,
          examAvg,
          courseProgress,
          score,
          examCount: branchSubs.length,
          courseCount: branchCourses.length,
        }
      })
      skills = allBranchSkills
    }
  }

  const submitted = assignments.filter((a) => a.status === 'تم التسليم').length
  const late = assignments.filter((a) => a.status === 'متأخر').length
  const missing = assignments.filter((a) => a.status === 'لم يسلّم').length
  
  const assignmentBreakdown = [
    { label: 'تم التسليم', value: submitted },
    { label: 'متأخر', value: late },
    { label: 'لم يسلّم', value: missing },
  ]

  // 8. Live presence — online if the student pinged within the last 2 minutes.
  const lastSeenAt: string | null = studentRow.last_seen_at ?? null
  const ONLINE_WINDOW_MS = 2 * 60 * 1000
  const isOnline = lastSeenAt
    ? Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS
    : false
  const presence = {
    isOnline,
    lastSeenLabel: lastSeenAt ? formatRelativeTime(lastSeenAt) : 'لم يظهر بعد',
    lastSeenAt,
  }

  return {
    student,
    studentDbId: studentId,
    device,
    totalSpent,
    courses,
    payments,
    exams,
    assignments,
    progressTrend,
    monthlySpend,
    completedLessonDates: completedLessons.map((d) => d.toISOString()),
    rawOrders: (ordersData || [])
      .filter((o: any) => o.status === 'approved' && o.created_at)
      .map((o: any) => ({ date: o.created_at as string, amount: Number(o.total) })),
    totalLessonsAll,
    skills,
    stageTitle,
    assignmentBreakdown,
    presence,
  }
}
