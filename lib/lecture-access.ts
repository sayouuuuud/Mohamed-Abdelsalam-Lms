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
 * Checks whether an authenticated user can watch a lecture through any
 * approved purchase mode: the lecture itself, its monthly course, or its term.
 *
 * This must use the auth user id because orders.student_id stores auth.users.id
 * in the current schema. The service-role client is safe here because every
 * query remains explicitly scoped to that user id.
 */
export async function userCanAccessLecture(
  admin: AdminClient,
  userId: string,
  lectureId: string,
): Promise<boolean> {
  const { data: lecture, error: lectureError } = await admin
    .from('lectures')
    .select('id, monthly_course_id, monthly_courses(term_id)')
    .eq('id', lectureId)
    .maybeSingle()

  if (lectureError || !lecture) return false

  const courseId = lecture.monthly_course_id as string | null
  const relation = lecture.monthly_courses as unknown as
    | { term_id: string | null }
    | { term_id: string | null }[]
    | null
  const termId = Array.isArray(relation)
    ? relation[0]?.term_id ?? null
    : relation?.term_id ?? null

  const { data: orders, error: ordersError } = await admin
    .from('orders')
    .select('order_items(lecture_id, monthly_course_id, term_id, item_type)')
    .eq('student_id', userId)
    .eq('status', 'approved')

  if (ordersError || !orders) return false

  for (const order of orders) {
    for (const item of (order.order_items ?? []) as OrderItem[]) {
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
