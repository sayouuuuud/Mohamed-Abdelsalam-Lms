'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { StudentProfile, DeviceInfo, EnrolledCourse, PaymentRecord, ExamGrade, AssignmentRecord, StudentStatus } from '@/lib/student-profile-data'

// ── Update student account status ─────────────────────────────────────────────
export async function updateStudentStatus(
  studentId: string,           // students.id (UUID)
  studentCode: string,         // students.code  (for revalidation)
  newStatus: StudentStatus,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('students')
    .update({ status: newStatus })
    .eq('id', studentId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/students/${studentCode}`)
  revalidatePath('/admin/students')
  return { success: true }
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

  const timeLabel = new Date().toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (channel === 'إشعار') {
    // Insert into notifications table
    const code = `NOTIF-${Date.now()}`
    const { error } = await supabase.from('notifications').insert({
      code,
      student_id: studentId,
      type: 'رسالة إدارية',
      title: subject || 'رسالة من الإدارة',
      description: body,
      time_label: timeLabel,
    })
    if (error) return { error: error.message }
  } else {
    // Insert or append into messages table
    // Check if an existing open thread exists for this student
    const { data: existing } = await supabase
      .from('messages')
      .select('id, code, chat_history, student_unread')
      .eq('student_id', studentId)
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
      const { error } = await supabase
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
      const { error } = await supabase.from('messages').insert({
        code,
        student_id: studentId,
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

  // 1. Fetch Student
  const { data: studentRow, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('code', code)
    .single()

  if (studentError || !studentRow) return null

  const studentId = studentRow.id
  const student = {
    id: studentRow.code,
    name: studentRow.name,
    email: studentRow.email || '',
    phone: studentRow.phone || '',
    gender: studentRow.gender,
    avatar: studentRow.avatar || undefined,
    courses: studentRow.courses,
    progress: studentRow.progress,
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

  // 3. Fetch Courses & Enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      id,
      progress,
      enrolled_at,
      courses (
        id,
        title,
        categories (name),
        course_sections (
          course_lessons (id)
        )
      ),
      lesson_progress (
        completed,
        completed_at
      )
    `)
    .eq('student_id', studentId)

  const courses: EnrolledCourse[] = (enrollments || []).map((enrollment: any) => {
    const course = enrollment.courses
    const category = course?.categories?.name || 'عام'
    
    // Count total lessons
    let lessonsTotal = 0
    course?.course_sections?.forEach((section: any) => {
      lessonsTotal += section.course_lessons?.length || 0
    })

    // Count completed lessons
    const lessonsDone = enrollment.lesson_progress?.filter((lp: any) => lp.completed).length || 0
    const progress = lessonsTotal > 0 ? Math.round((lessonsDone / lessonsTotal) * 100) : 0

    // Find last accessed
    let lastAccessedDate = enrollment.enrolled_at
    enrollment.lesson_progress?.forEach((lp: any) => {
      if (lp.completed_at && new Date(lp.completed_at) > new Date(lastAccessedDate)) {
        lastAccessedDate = lp.completed_at
      }
    })

    return {
      id: course.id,
      name: course.title,
      category,
      progress,
      lessonsDone,
      lessonsTotal,
      lastAccessed: formatRelativeTime(lastAccessedDate),
      status: progress >= 100 ? 'مكتمل' : progress === 0 ? 'متوقف' : 'قيد التقدم',
    }
  })

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
      status: o.status === 'مقبول' ? 'ناجح' : o.status === 'مرفوض' ? 'مسترد' : 'معلّق',
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
    let status: AssignmentRecord['status'] = 'لم يسلّم'
    if (a.status === 'تم التقييم' || a.status === 'مقبول') status = 'تم التسليم'
    
    return {
      id: a.id,
      name: a.assignments?.title || 'واجب',
      course: a.assignments?.courses?.title || 'كورس',
      dueDate: formatJoinedAt(a.assignments?.due_date || a.submitted_at || new Date().toISOString()),
      status,
      grade: a.score,
    }
  })

  // 7. Generate Dashboard Analytics (Mocked/Calculated for now since we don't have historical snapshots)
  const progressTrend = [
    { month: 'يناير', progress: Math.max(0, student.progress - 50) },
    { month: 'فبراير', progress: Math.max(0, student.progress - 40) },
    { month: 'مارس', progress: Math.max(0, student.progress - 30) },
    { month: 'أبريل', progress: Math.max(0, student.progress - 20) },
    { month: 'مايو', progress: Math.max(0, student.progress - 10) },
    { month: 'يونيو', progress: student.progress },
  ]

  const spendBase = Math.round(totalSpent / 6)
  const monthlySpend = [
    { month: 'يناير', amount: spendBase },
    { month: 'فبراير', amount: spendBase },
    { month: 'مارس', amount: spendBase },
    { month: 'أبريل', amount: spendBase },
    { month: 'مايو', amount: spendBase },
    { month: 'يونيو', amount: spendBase },
  ]

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

      skills = branchRows.map((branch: any) => {
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
    skills,
    stageTitle,
    assignmentBreakdown,
  }
}
