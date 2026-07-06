'use server'

import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { createNotification } from '@/lib/notify'
import { revalidatePath } from 'next/cache'
import {
  formatRelativeArabic,
  type NotificationRecord,
  type NotificationType,
} from '@/lib/notifications-data'

// Returns the year/branch/lecture lists used to optionally target an
// announcement. Empty arrays when the catalog is empty.
export async function getNotificationTargets() {
  const supabase = await createClient()
  const [stagesRes, branchesRes, lecturesRes] = await Promise.all([
    supabase.from('stages').select('id, title, sort_order').order('sort_order'),
    supabase
      .from('branches')
      .select('id, stage_id, title, sort_order')
      .order('sort_order'),
    supabase
      .from('lectures')
      .select('id, branch_id, title, sort_order')
      .order('sort_order'),
  ])

  return {
    stages: stagesRes.data ?? [],
    branches: branchesRes.data ?? [],
    lectures: lecturesRes.data ?? [],
  }
}

// Admin broadcasts an announcement to students. All targeting is optional:
//   • nothing set            → every student (broadcast)
//   • stageId set            → only that year
//   • branchId set           → only students in that branch
//   • lectureId set          → only students who bought that lecture
export async function sendAnnouncement(input: {
  title: string
  description: string
  stageId?: string | null
  branchId?: string | null
  lectureId?: string | null
}) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'notifications'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }
  const title = input.title.trim()
  if (!title) return { error: 'العنوان مطلوب.' }

  const res = await createNotification({
    type: 'طالب',
    title,
    description: input.description.trim(),
    stageId: input.stageId || null,
    branchId: input.branchId || null,
    lectureId: input.lectureId || null,
  })
  if (res.error) return { error: 'تعذّر إرسال الإشعار. حاول تاني.' }

  revalidatePath('/notifications')
  revalidatePath('/student/notifications')
  return { success: true }
}

export async function getNotifications(): Promise<NotificationRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.code,
    type: row.type as NotificationType,
    title: row.title,
    description: row.description,
    // Compute the label live from created_at so it always matches the (newest
    // first) ordering instead of the stale label stored at insert time.
    time: formatRelativeArabic(row.created_at),
    read: row.read,
  }))
}

export async function markAsRead(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'notifications'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('code', id)

  if (error) return { error: error.message }
  revalidatePath('/notifications')
  return { success: true }
}

export async function markAllAsRead() {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'notifications'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false)

  if (error) return { error: error.message }
  revalidatePath('/notifications')
  return { success: true }
}

export async function deleteNotification(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'notifications'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase.from('notifications').delete().eq('code', id)
  if (error) return { error: error.message }
  revalidatePath('/notifications')
  return { success: true }
}
