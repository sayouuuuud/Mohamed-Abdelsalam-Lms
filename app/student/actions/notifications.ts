'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentStudent } from '@/lib/auth-guard'
import { formatRelativeArabic } from '@/lib/notifications-data'

export async function getStudentTargeting(student: any) {
  const stageId: string | null = student.stage_id ?? null

  const enrollments = await prisma.enrollments.findMany({
    where: { student_id: student.id },
    select: { course_id: true }
  })
  const enrolledLectureIds = enrollments.map((e) => e.course_id).filter(Boolean) as string[]

  let orderedLectureIds: string[] = []
  if (student.user_id) {
    const orderItems = await prisma.orders.findMany({
      where: {
        student_id: student.user_id,
        status: 'approved'
      },
      select: {
        order_items: { select: { lecture_id: true } }
      }
    })
    orderedLectureIds = orderItems
      .flatMap((o) => o.order_items.map((i) => i.lecture_id))
      .filter(Boolean) as string[]
  }

  const lectureIds = Array.from(new Set([...enrolledLectureIds, ...orderedLectureIds]))

  let branchIds: string[] = []
  if (lectureIds.length > 0) {
    const lectures = await prisma.lectures.findMany({
      where: { id: { in: lectureIds } },
      select: { branch_id: true }
    })
    branchIds = Array.from(new Set(lectures.map((l) => l.branch_id).filter(Boolean))) as string[]
  }

  return { stageId, lectureIds, branchIds }
}

function filterByTargeting(
  notifs: any[],
  studentId: string,
  stageId: string | null,
  lectureIds: string[],
  branchIds: string[],
) {
  const lectureSet = new Set(lectureIds)
  const branchSet = new Set(branchIds)

  return notifs.filter((n) => {
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
  const student = await getCurrentStudent()
  if (!student) return []

  const { stageId, lectureIds, branchIds } = await getStudentTargeting(student)

  const notifs = await prisma.notifications.findMany({
    where: {
      OR: [
        { student_id: student.id },
        { student_id: null }
      ]
    },
    orderBy: { created_at: 'desc' },
    take: 50
  })

  const visible = filterByTargeting(notifs, student.id, stageId, lectureIds, branchIds)

  return visible.slice(0, 5).map((n) => ({
    id: n.code ?? n.id,
    title: n.title,
    text: n.description,
    time: formatRelativeArabic(n.created_at.toISOString()),
    course: 'منصة',
  }))
}

function mapNotifType(type: string): 'lesson' | 'exam' | 'assignment' | 'grade' | 'message' | 'system' {
  switch (type) {
    case 'كورس': return 'lesson'
    case 'اختبار': return 'exam'
    case 'رسالة': return 'message'
    case 'طالب': return 'system'
    default: return 'system'
  }
}

export async function getStudentNotifications() {
  const student = await getCurrentStudent()
  if (!student) return []

  const { stageId, lectureIds, branchIds } = await getStudentTargeting(student)

  const notifs = await prisma.notifications.findMany({
    where: {
      OR: [
        { student_id: student.id },
        { student_id: null }
      ]
    },
    orderBy: { created_at: 'desc' },
    take: 100
  })

  const rows = filterByTargeting(notifs, student.id, stageId, lectureIds, branchIds)

  const reads = await prisma.notification_reads.findMany({
    where: { student_id: student.id },
    select: { notification_id: true }
  })
  const readIds = new Set(reads.map((r) => r.notification_id))

  rows.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

  return rows.map((n) => ({
    id: n.code ?? n.id,
    notifId: n.id,
    type: mapNotifType(n.type),
    title: n.title,
    text: n.description,
    time: formatRelativeArabic(n.created_at.toISOString()),
    read: readIds.has(n.id),
  }))
}

export async function markStudentNotificationRead(notifId: string) {
  const student = await getCurrentStudent()
  if (!student) return { error: 'لازم تسجّل دخول.' }

  await prisma.notification_reads.upsert({
    where: {
      notification_id_student_id: {
        notification_id: notifId,
        student_id: student.id
      }
    },
    update: {},
    create: {
      notification_id: notifId,
      student_id: student.id
    }
  })

  revalidatePath('/student/notifications')
  return { success: true }
}

export async function markAllStudentNotificationsRead(notifIds: string[]) {
  const student = await getCurrentStudent()
  if (!student) return { error: 'لازم تسجّل دخول.' }
  if (notifIds.length === 0) return { success: true }

  for (const id of notifIds) {
    await prisma.notification_reads.upsert({
      where: {
        notification_id_student_id: {
          notification_id: id,
          student_id: student.id
        }
      },
      update: {},
      create: {
        notification_id: id,
        student_id: student.id
      }
    })
  }

  revalidatePath('/student/notifications')
  return { success: true }
}
