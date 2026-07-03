'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-guard'

export type AdminSidebarBadges = {
  orders: number
  messages: number
  notifications: number
}

// Live counts for the admin sidebar badges:
//  - orders:        طلبات دفع معلّقة تحتاج مراجعة (orders.status = 'pending')
//  - messages:      محادثات فيها رسائل غير مقروءة (messages.unread_count > 0)
//  - notifications: إشعارات غير مقروءة (notifications.read = false)
export async function getAdminSidebarBadges(): Promise<AdminSidebarBadges> {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { orders: 0, messages: 0, notifications: 0 }
  }

  const [orders, messages, notifications] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .gt('unread_count', 0),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false),
  ])

  return {
    orders: orders.count ?? 0,
    messages: messages.count ?? 0,
    notifications: notifications.count ?? 0,
  }
}
