import 'server-only'

import { prisma } from '@/lib/prisma'

/**
 * Returns true if the auth user (userId) has an approved
 * purchase that covers the given lectureId via any of three paths:
 *   1. Direct lecture purchase  (item_type = 'lecture',       lecture_id = lectureId)
 *   2. Course bundle            (item_type = 'course_bundle', monthly_course_id = lecture.monthly_course_id)
 *   3. Term bundle              (item_type = 'term_bundle',   term_id = monthly_course.term_id)
 */
export async function userCanAccessLecture(
  userId: string,
  lectureId: string,
): Promise<boolean> {
  const lecture = await prisma.lectures.findUnique({
    where: { id: lectureId },
    select: { id: true, monthly_course_id: true }
  })

  if (!lecture) return false
  const courseId: string | null = lecture.monthly_course_id ?? null

  let termId: string | null = null
  if (courseId) {
    const course = await prisma.monthly_courses.findUnique({
      where: { id: courseId },
      select: { term_id: true }
    })
    termId = course?.term_id ?? null
  }

  const orders = await prisma.orders.findMany({
    where: { student_id: userId, status: 'approved' },
    select: {
      order_items: {
        select: { lecture_id: true, monthly_course_id: true, term_id: true, item_type: true }
      }
    }
  })

  if (!orders) return false

  for (const order of orders) {
    for (const item of order.order_items) {
      if (item.lecture_id === lectureId) return true

      if (
        courseId &&
        item.item_type === 'course_bundle' &&
        item.monthly_course_id === courseId
      ) {
        return true
      }

      if (
        termId &&
        item.item_type === 'term_bundle' &&
        item.term_id === termId
      ) {
        return true
      }
    }
  }

  return false
}
