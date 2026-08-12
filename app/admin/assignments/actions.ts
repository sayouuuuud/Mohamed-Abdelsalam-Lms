'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit-log'

export type AssignmentOverview = {
  id: string
  code: string
  title: string
  type: string
  courseTitle: string
  dueDate: string | null
  points: number
  submittedCount: number
  pendingCount: number
  gradedCount: number
  avgScore: number
  createdAt: string
}

const SUBMITTED_STATUSES = ['تم التسليم', 'مصحّح']

export async function getAssignmentsOverview(): Promise<AssignmentOverview[]> {
  if (!(await hasResourceAccess('courses'))) return []

  const assignments = await prisma.assignments.findMany({
    select: {
      id: true,
      code: true,
      title: true,
      type: true,
      due_date: true,
      points: true,
      created_at: true,
      lectures: { select: { title: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  if (assignments.length === 0) return []

  const submissions = await prisma.assignment_submissions.findMany({
    where: { assignment_id: { in: assignments.map((a) => a.id) } },
    select: { assignment_id: true, status: true, score: true },
  })

  const byAssignment = new Map<string, typeof submissions>()
  for (const s of submissions) {
    const arr = byAssignment.get(s.assignment_id) ?? []
    arr.push(s)
    byAssignment.set(s.assignment_id, arr)
  }

  return assignments.map((a) => {
    const subs = byAssignment.get(a.id) ?? []
    const submittedCount = subs.filter((s) => SUBMITTED_STATUSES.includes(s.status)).length
    const pendingCount = subs.filter((s) => s.status === 'تم التسليم').length
    const gradedSubs = subs.filter((s) => s.status === 'مصحّح' && s.score != null)
    const avgScore =
      gradedSubs.length > 0
        ? Math.round(gradedSubs.reduce((sum, s) => sum + (s.score ?? 0), 0) / gradedSubs.length)
        : 0

    return {
      id: a.id,
      code: a.code,
      title: a.title,
      type: a.type,
      courseTitle: a.lectures?.title ?? 'عام',
      dueDate: a.due_date
        ? a.due_date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
        : null,
      points: a.points,
      submittedCount,
      pendingCount,
      gradedCount: gradedSubs.length,
      avgScore,
      createdAt: a.created_at.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    }
  })
}

export type AssignmentsStatsData = {
  total: number
  totalSubmissions: number
  pendingReview: number
  avgScore: number
}

export async function getAssignmentsStats(): Promise<AssignmentsStatsData> {
  if (!(await hasResourceAccess('courses'))) {
    return { total: 0, totalSubmissions: 0, pendingReview: 0, avgScore: 0 }
  }

  const [total, submissions] = await Promise.all([
    prisma.assignments.count(),
    prisma.assignment_submissions.findMany({ select: { status: true, score: true } }),
  ])

  const totalSubmissions = submissions.filter((s) => SUBMITTED_STATUSES.includes(s.status)).length
  const pendingReview = submissions.filter((s) => s.status === 'تم التسليم').length
  const graded = submissions.filter((s) => s.status === 'مصحّح' && s.score != null)
  const avgScore =
    graded.length > 0
      ? Math.round(graded.reduce((sum, s) => sum + (s.score ?? 0), 0) / graded.length)
      : 0

  return { total, totalSubmissions, pendingReview, avgScore }
}

export type AssignmentSubmissionDetail = {
  id: string
  studentId: string
  studentName: string
  studentCode: string
  status: string
  score: number | null
  attachmentUrl: string | null
  submittedAt: string | null
}

export type AssignmentDetailsData = {
  id: string
  code: string
  title: string
  type: string
  description: string
  instructions: string[]
  courseTitle: string
  dueDate: string | null
  points: number
  createdAt: string
  submissions: AssignmentSubmissionDetail[]
}

export async function getAssignmentDetails(code: string): Promise<AssignmentDetailsData | null> {
  if (!(await hasResourceAccess('courses'))) return null

  const assignment = await prisma.assignments.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      title: true,
      type: true,
      description: true,
      instructions: true,
      due_date: true,
      points: true,
      created_at: true,
      lectures: { select: { title: true } },
    },
  })
  if (!assignment) return null

  const submissionsData = await prisma.assignment_submissions.findMany({
    where: { assignment_id: assignment.id },
    include: { students: { select: { id: true, name: true, code: true } } },
    orderBy: { submitted_at: 'desc' },
  })

  const submissions: AssignmentSubmissionDetail[] = submissionsData.map((s) => ({
    id: s.id,
    studentId: s.students?.id || s.student_id,
    studentName: s.students?.name || 'غير معروف',
    studentCode: s.students?.code || '-',
    status: s.status,
    score: s.score ?? null,
    attachmentUrl: s.attachment_url ?? null,
    submittedAt: s.submitted_at
      ? s.submitted_at.toLocaleString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
  }))

  return {
    id: assignment.id,
    code: assignment.code,
    title: assignment.title,
    type: assignment.type,
    description: assignment.description ?? '',
    instructions: assignment.instructions ?? [],
    courseTitle: assignment.lectures?.title ?? 'عام',
    dueDate: assignment.due_date
      ? assignment.due_date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
      : null,
    points: assignment.points,
    createdAt: assignment.created_at.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    submissions,
  }
}

export async function gradeAssignmentSubmission(submissionId: string, score: number) {
  if (!(await hasResourceAccess('courses', 'manage'))) {
    return { success: false, error: 'غير مصرح لك' }
  }

  const submission = await prisma.assignment_submissions.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      assignments: { select: { code: true, points: true } },
    },
  })
  if (!submission) return { success: false, error: 'التسليم غير موجود' }

  const maxPoints = submission.assignments?.points ?? 0
  const awarded = Math.max(0, Math.min(maxPoints || score, Math.round(score)))

  try {
    await prisma.assignment_submissions.update({
      where: { id: submissionId },
      data: { score: awarded, status: 'مصحّح' },
    })

    const code = submission.assignments?.code
    logActivity({
      action: 'update',
      resource: 'courses',
      targetId: submissionId,
      targetLabel: `تصحيح واجب — الدرجة: ${awarded}/${maxPoints}`,
    }).catch(() => {})

    if (code) revalidatePath(`/admin/assignments/${code}`)
    revalidatePath('/admin/assignments')
    revalidatePath('/student/assignments')

    return { success: true, score: awarded }
  } catch (error: any) {
    return { success: false, error: 'تعذّر حفظ الدرجة' }
  }
}
