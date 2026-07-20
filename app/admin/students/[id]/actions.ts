'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import type { StudentProfile, DeviceInfo, EnrolledCourse, PaymentRecord, ExamGrade, AssignmentRecord, StudentStatus } from '@/lib/student-profile-data'
import type { StudentGender } from '@/lib/students-data'

export async function updateStudentStatus(
  studentId: string,
  studentCode: string,
  newStatus: StudentStatus,
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!(await hasResourceAccess('students', 'manage'))) {
      return { error: 'غير مسموح.' }
    }

    const updated = await prisma.students.update({
      where: { id: studentId },
      data: { status: newStatus },
      select: { id: true }
    })

    if (!updated) {
      return { error: 'لم يتم العثور على الطالب في قاعدة البيانات.' }
    }

    logActivity({ action: 'update', resource: 'students', targetId: studentCode, targetLabel: `حالة طالب: ${newStatus}` }).catch(() => {})
    revalidatePath(`/admin/students/${studentCode}`)
    revalidatePath('/admin/students')
    return { success: true }
  } catch (e: any) {
    return { error: 'حدث خطأ غير متوقع أثناء تغيير الحالة.' }
  }
}

export async function sendMessageToStudent(
  studentId: string,
  studentCode: string,
  studentName: string,
  subject: string,
  body: string,
  channel: 'رسالة داخلية' | 'إشعار',
): Promise<{ success?: boolean; error?: string }> {
  if (!(await hasResourceAccess('students', 'manage'))) {
    return { error: 'غير مسموح.' }
  }

  const timeLabel = new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

  try {
    if (channel === 'إشعار') {
      const code = `NOTIF-${Date.now()}`
      await prisma.notifications.create({
        data: {
          code,
          student_id: studentId,
          type: 'رسالة',
          title: subject || 'رسالة من الإدارة',
          description: body,
          time_label: timeLabel,
        }
      })
    } else {
      const studentRow = await prisma.students.findUnique({
        where: { id: studentId },
        select: { user_id: true }
      })

      if (!studentRow?.user_id) {
        return { error: 'الطالب غير مرتبط بحساب مستخدم.' }
      }
      const studentUserId = studentRow.user_id

      const existing = await prisma.messages.findFirst({
        where: { student_id: studentUserId, status: 'open' },
        select: { id: true, code: true, chat_history: true, student_unread: true },
        orderBy: { created_at: 'desc' }
      })

      const newMsg = {
        id: `m${Date.now()}`,
        fromMe: true,
        text: body,
        time: 'الآن',
      }

      if (existing) {
        const history = (existing.chat_history as any[]) ?? []
        await prisma.messages.update({
          where: { id: existing.id },
          data: {
            chat_history: [...history, newMsg] as any,
            content: body,
            time_label: timeLabel,
            student_unread: (existing.student_unread ?? 0) + 1,
          }
        })
      } else {
        const code = `MSG-ADMIN-${Date.now()}`
        await prisma.messages.create({
          data: {
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
            chat_history: [newMsg] as any,
            status: 'open',
          }
        })
      }
    }

    logActivity({ action: 'create', resource: 'students', targetId: studentCode, targetLabel: `رسالة لـ ${studentName} (${channel})` }).catch(() => {})
    revalidatePath(`/admin/students/${studentCode}`)
    revalidatePath('/admin/messages')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

function formatRelativeTime(date: string | Date | null): string {
  if (!date) return 'غير معروف';
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

function formatJoinedAt(date: string | Date | null): string {
  if (!date) return 'غير معروف'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return String(date)
  }
}

export async function getStudentProfileData(code: string): Promise<StudentProfile | null> {
  if (!(await hasResourceAccess('students'))) return null

  const studentRow = await prisma.students.findUnique({
    where: { code }
  })

  if (!studentRow) return null

  const studentId = studentRow.id
  const studentUserId = studentRow.user_id

  const student: any = {
    id: studentRow.code,
    name: studentRow.name,
    email: studentRow.email || '',
    phone: studentRow.phone || '',
    gender: studentRow.gender as StudentGender,
    avatar: studentRow.avatar || undefined,
    courses: 0,
    progress: 0,
    spent: studentRow.spent,
    status: studentRow.status as StudentStatus,
    joinedAt: formatJoinedAt(studentRow.joined_at),
  }

  const deviceRow = await prisma.student_devices.findFirst({
    where: { student_id: studentId }
  })

  const device: DeviceInfo = deviceRow
    ? {
        browser: deviceRow.browser ?? 'غير معروف',
        os: deviceRow.os ?? 'غير معروف',
        deviceType: deviceRow.device_type ?? 'غير معروف',
        ip: deviceRow.ip ?? 'غير معروف',
        city: deviceRow.city ?? 'غير معروف',
        country: deviceRow.country ?? 'غير معروف',
        lastActive: formatRelativeTime(deviceRow.last_active),
        sessions: deviceRow.sessions ?? 0,
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

  let lectureRows: Array<{ lectureId: string; title: string; category: string; purchasedAt: Date; lessonIds: string[] }> = []
  let orderedItems: any[] = []
  let progressRows: any[] = []
  let legacyProgress: any[] = []
  let ordersData: any[] = []

  if (studentUserId) {
    orderedItems = await prisma.orders.findMany({
      where: { student_id: studentUserId, status: 'approved' },
      select: {
        created_at: true,
        status: true,
        order_items: {
          select: {
            lecture_id: true,
            lecture_title: true,
            branch_title: true,
            stage_title: true,
            lectures: {
              select: { id: true, title: true, lessons: { select: { id: true } } }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    const seenLectureIds = new Set<string>()
    for (const order of orderedItems) {
      for (const item of order.order_items) {
        const lectureId = item.lecture_id
        if (!lectureId || seenLectureIds.has(lectureId)) continue
        seenLectureIds.add(lectureId)

        const lecObj = item.lectures
        const lessonIds = (lecObj?.lessons ?? []).map((l: any) => l.id).filter(Boolean)

        lectureRows.push({
          lectureId,
          title: item.lecture_title || lecObj?.title || 'محاضرة',
          category: item.branch_title || 'عام',
          purchasedAt: order.created_at,
          lessonIds,
        })
      }
    }

    progressRows = await prisma.student_content_progress.findMany({
      where: { user_id: studentUserId, item_type: 'lesson', status: 'completed' },
      select: { item_id: true, updated_at: true }
    })

    legacyProgress = await prisma.lesson_progress.findMany({
      where: { enrollments: { student_id: studentId }, completed: true },
      select: { lesson_id: true, completed_at: true }
    })

    ordersData = await prisma.orders.findMany({
      where: { student_id: studentUserId },
      select: {
        id: true,
        code: true,
        total: true,
        subtotal: true,
        discount: true,
        method: true,
        status: true,
        created_at: true,
        coupon_code: true,
        order_items: { select: { lecture_title: true, branch_title: true, stage_title: true, price: true } }
      },
      orderBy: { created_at: 'desc' }
    })
  }

  const completedIds = new Set<string>([
    ...progressRows.map((r) => r.item_id),
    ...legacyProgress.map((r) => r.lesson_id),
  ])

  const courses: EnrolledCourse[] = lectureRows.map((lec) => {
    const totalLessons = lec.lessonIds.length
    const lessonsDone = lec.lessonIds.filter((id) => completedIds.has(id)).length
    const progress = totalLessons > 0 ? Math.round((lessonsDone / totalLessons) * 100) : 0

    let lastAccessedDate = lec.purchasedAt
    for (const row of progressRows) {
      if (lec.lessonIds.includes(row.item_id) && row.updated_at) {
        if (row.updated_at > lastAccessedDate) lastAccessedDate = row.updated_at
      }
    }
    for (const row of legacyProgress) {
      if (lec.lessonIds.includes(row.lesson_id) && row.completed_at) {
        if (row.completed_at > lastAccessedDate) lastAccessedDate = row.completed_at
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

  student.courses = courses.length
  student.progress = courses.length > 0 ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length) : 0

  const payments: PaymentRecord[] = ordersData.map((o) => {
    const items = o.order_items.map((i: any) => i.lecture_title).filter(Boolean)
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

  const examsData = await prisma.exam_submissions.findMany({
    where: { student_id: studentId },
    select: { id: true, score: true, total: true, status: true, submitted_at: true, exams: { select: { title: true, course: true } } },
    orderBy: { submitted_at: 'desc' }
  })

  const exams: ExamGrade[] = examsData.map((e) => ({
    id: e.id,
    name: e.exams?.title || 'امتحان',
    course: e.exams?.course || 'كورس',
    score: e.score ? Number(e.score) : 0,
    total: e.total ? Number(e.total) : 0,
    date: formatJoinedAt(e.submitted_at),
    status: e.status as ExamGrade['status'],
  }))

  const assignmentsData = await prisma.assignment_submissions.findMany({
    where: { student_id: studentId },
    select: { id: true, status: true, score: true, submitted_at: true, assignments: { select: { title: true, due_date: true, courses: { select: { title: true } } } } },
    orderBy: { submitted_at: 'desc' }
  })

  const assignments: AssignmentRecord[] = assignmentsData.map((a) => {
    let status: AssignmentRecord['status'] = 'تم التسليم'
    if (a.status === 'متأخر') status = 'متأخر'
    else if (a.status === 'لم يسلّم') status = 'لم يسلّم'

    return {
      id: a.id,
      name: a.assignments?.title || 'واجب',
      course: a.assignments?.courses?.title || 'كورس',
      dueDate: formatJoinedAt(a.assignments?.due_date || a.submitted_at || new Date()),
      status,
      grade: a.score ? Number(a.score) : 0,
    }
  })

  const arMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  const now = new Date()
  const monthBuckets = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: arMonths[d.getMonth()] }
  })

  const totalLessonsAll = courses.reduce((sum, c) => sum + c.lessonsTotal, 0)
  const completedLessons: Date[] = [
    ...progressRows.filter((r) => r.updated_at).map((r) => new Date(r.updated_at)),
    ...legacyProgress.filter((r) => r.completed_at).map((r) => new Date(r.completed_at)),
  ]

  const progressTrend = monthBuckets.map((b) => {
    const endOfMonth = new Date(b.year, b.month + 1, 0, 23, 59, 59)
    const doneByThen = completedLessons.filter((d) => d <= endOfMonth).length
    const progress = totalLessonsAll > 0 ? Math.round((doneByThen / totalLessonsAll) * 100) : 0
    return { month: b.label, progress }
  })

  const monthlySpend = monthBuckets.map((b) => {
    const amount = ordersData
      .filter((o) => o.status === 'approved' && o.created_at)
      .filter((o) => {
        const d = new Date(o.created_at)
        return d.getFullYear() === b.year && d.getMonth() === b.month
      })
      .reduce((sum, o) => sum + Number(o.total), 0)
    return { month: b.label, amount }
  })

  let stageTitle = ''
  let skills: StudentProfile['skills'] = []

  if (studentRow.stage_id) {
    const stageRow = await prisma.stages.findUnique({
      where: { id: studentRow.stage_id },
      select: { title: true }
    })
    stageTitle = stageRow?.title || ''

    const branchRows = await prisma.branches.findMany({
      where: { stage_id: studentRow.stage_id },
      select: { id: true, title: true, sort_order: true },
      orderBy: { sort_order: 'asc' }
    })

    if (branchRows.length > 0) {
      const branchExams = await prisma.exam_submissions.findMany({
        where: { student_id: studentId },
        select: { score: true, total: true, grading_status: true, exams: { select: { branch_id: true } } }
      })

      const branchEnrollments = await prisma.enrollments.findMany({
        where: { student_id: studentId },
        select: { id: true, courses: { select: { id: true, branch_id: true } } }
      })

      const courseProgressMap = new Map(courses.map((c) => [c.id, c.progress]))

      skills = branchRows.map((branch) => {
        const branchSubs = branchExams.filter(
          (s) => s.exams?.branch_id === branch.id && (s.grading_status ?? 'graded') === 'graded' && (s.total ?? 0) > 0
        )
        const examAvg = branchSubs.length > 0
          ? Math.round(branchSubs.reduce((sum, s) => sum + (Number(s.score) / Number(s.total)) * 100, 0) / branchSubs.length)
          : 0

        const branchCourses = branchEnrollments.filter((e) => e.courses?.branch_id === branch.id)
        const courseProgress = branchCourses.length > 0
          ? Math.round(branchCourses.reduce((sum, e) => {
              const pct = courseProgressMap.get(e.courses?.id ?? '') ?? 0
              return sum + pct
            }, 0) / branchCourses.length)
          : 0

        const parts: number[] = []
        if (branchSubs.length > 0) parts.push(examAvg)
        if (branchCourses.length > 0) parts.push(courseProgress)
        const score = parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0

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

  const lastSeenAt = studentRow.last_seen_at
  const ONLINE_WINDOW_MS = 2 * 60 * 1000
  const isOnline = lastSeenAt ? Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS : false
  const presence = {
    isOnline,
    lastSeenLabel: lastSeenAt ? formatRelativeTime(lastSeenAt) : 'لم يظهر بعد',
    lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
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
    rawOrders: ordersData.filter((o) => o.status === 'approved' && o.created_at).map((o) => ({ date: o.created_at.toISOString(), amount: Number(o.total) })),
    totalLessonsAll,
    skills,
    stageTitle,
    assignmentBreakdown,
    presence,
  }
}
