import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

type OrderItem = {
  lecture_id: string | null
  monthly_course_id: string | null
  term_id: string | null
  item_type: string | null
}

/**
 * Returns true if the auth user (userId = auth.users.id) has an approved
 * purchase that covers the given lectureId via any of three paths:
 *   1. Direct lecture purchase  (item_type = 'lecture',       lecture_id = lectureId)
 *   2. Course bundle            (item_type = 'course_bundle', monthly_course_id = lecture.monthly_course_id)
 *   3. Term bundle              (item_type = 'term_bundle',   term_id = monthly_course.term_id)
 *
 * orders.student_id stores auth.users.id directly, so userId must be the
 * auth uid, not students.id.
 */
export async function userCanAccessLecture(
  admin: AdminClient,
  userId: string,
  lectureId: string,
): Promise<boolean> {
  // Step 1: resolve the lecture's course & term IDs (two plain queries — no nested select).
  const { data: lecture } = await admin
    .from('lectures')
    .select('id, monthly_course_id')
    .eq('id', lectureId)
    .maybeSingle()

  if (!lecture) return false
  const courseId: string | null = lecture.monthly_course_id ?? null

  let termId: string | null = null
  if (courseId) {
    const { data: course } = await admin
      .from('monthly_courses')
      .select('term_id')
      .eq('id', courseId)
      .maybeSingle()
    termId = course?.term_id ?? null
  }

  // Step 2: fetch all approved order items for this user.
  const { data: orders } = await admin
    .from('orders')
    .select('order_items(lecture_id, monthly_course_id, term_id, item_type)')
    .eq('student_id', userId)
    .eq('status', 'approved')

  if (!orders) return false

  for (const order of orders) {
    for (const item of (order.order_items ?? []) as OrderItem[]) {
      // Direct lecture purchase.
      if (item.lecture_id === lectureId) return true

      // Course bundle covers this lecture.
      if (
        courseId &&
        item.item_type === 'course_bundle' &&
        item.monthly_course_id === courseId
      ) {
        return true
      }

      // Term bundle covers the course that contains this lecture.
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
