'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { createNotification } from '@/lib/notify'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit-log'
import {
  formatRelativeArabic,
  type NotificationRecord,
  type NotificationType,
} from '@/lib/notifications-data'

export async function getNotificationTargets() {
  const [stages, branches, lectures] = await Promise.all([
    prisma.stages.findMany({ select: { id: true, title: true, sort_order: true }, orderBy: { sort_order: 'asc' } }),
    prisma.branches.findMany({ select: { id: true, stage_id: true, title: true, sort_order: true }, orderBy: { sort_order: 'asc' } }),
    prisma.lectures.findMany({ select: { id: true, branch_id: true, title: true, sort_order: true }, orderBy: { sort_order: 'asc' } }),
  ])

  return { stages, branches, lectures }
}

export async function sendAnnouncement(input: {
  title: string
  description: string
  stageId?: string | null
  branchId?: string | null
  lectureId?: string | null
}) {
  if (!(await hasResourceAccess('notifications', 'manage'))) {
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

  logActivity({ action: 'create', resource: 'notifications', targetLabel: `إشعار: ${title}` }).catch(() => {})
  revalidatePath('/notifications')
  revalidatePath('/student/notifications')
  return { success: true }
}

export async function getNotifications(): Promise<NotificationRecord[]> {
  const data = await prisma.notifications.findMany({
    orderBy: { created_at: 'desc' }
  })

  return data.map((row) => ({
    id: row.code,
    type: row.type as NotificationType,
    title: row.title,
    description: row.description,
    time: formatRelativeArabic(row.created_at.toISOString()),
    read: row.read,
  }))
}

export async function markAsRead(id: string) {
  if (!(await hasResourceAccess('notifications', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.notifications.update({
      where: { code: id },
      data: { read: true }
    })
    revalidatePath('/notifications')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذر التحديث.' }
  }
}

export async function markAllAsRead() {
  if (!(await hasResourceAccess('notifications', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.notifications.updateMany({
      where: { read: false },
      data: { read: true }
    })
    revalidatePath('/notifications')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذر التحديث.' }
  }
}

export async function deleteNotification(id: string) {
  if (!(await hasResourceAccess('notifications', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.notifications.delete({ where: { code: id } })
    logActivity({ action: 'delete', resource: 'notifications', targetId: id, targetLabel: `إشعار كود: ${id}` }).catch(() => {})
    revalidatePath('/notifications')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذر الحذف.' }
  }
}
