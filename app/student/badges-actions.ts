'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStudentNotifications, getStudentInvoices } from './actions'

export type StudentSidebarBadges = {
  messages: number
  notifications: number
  billing: number
}

// Live counts for the student sidebar badges:
//  - messages:      تذاكر فيها ردود جديدة من المدرّس (student_unread > 0)
//  - notifications: إشعارات لم يقرأها الطالب بعد
//  - billing:       فواتير غير مدفوعة أو مرفوضة تحتاج إجراء
export async function getStudentSidebarBadges(): Promise<StudentSidebarBadges> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { messages: 0, notifications: 0, billing: 0 }

  const [notifs, invoices, msgs] = await Promise.all([
    getStudentNotifications(),
    getStudentInvoices(),
    createAdminClient()
      .from('messages')
      .select('student_unread')
      .eq('student_id', user.id),
  ])

  const messages = (msgs.data ?? []).filter(
    (m: any) => (m.student_unread ?? 0) > 0,
  ).length
  const notifications = notifs.filter((n: any) => !n.read).length
  const billing = invoices.filter(
    (i) => i.status === 'غير مدفوعة' || i.status === 'مرفوضة',
  ).length

  return { messages, notifications, billing }
}
