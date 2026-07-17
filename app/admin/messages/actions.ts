'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit-log'
import type { Conversation, ChatMessage, TicketStatus } from '@/lib/messages-data'

export async function getConversations(): Promise<Conversation[]> {
  const data = await prisma.messages.findMany({
    select: { code: true, sender_name: true, subject: true, content: true, time_label: true, unread_count: true, status: true, chat_history: true },
    orderBy: { created_at: 'desc' }
  })

  return data.map((row) => ({
    id: row.code,
    name: row.sender_name,
    subject: row.subject || 'تذكرة دعم',
    preview: row.content,
    time: row.time_label,
    unread: row.unread_count ?? 0,
    status: (row.status as TicketStatus) ?? 'open',
    messages: (row.chat_history ? (typeof row.chat_history === 'string' ? JSON.parse(row.chat_history) : row.chat_history) : []) as ChatMessage[],
  }))
}

export async function markAsRead(id: string) {
  if (!(await hasResourceAccess('messages', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.messages.update({
      where: { code: id },
      data: { unread_count: 0, is_read: true }
    })
    revalidatePath('/admin/messages')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذر تحديث المحادثة.' }
  }
}

export async function markAllAsRead() {
  if (!(await hasResourceAccess('messages', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.messages.updateMany({
      where: { unread_count: { gt: 0 } },
      data: { unread_count: 0, is_read: true }
    })
    revalidatePath('/admin/messages')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذر تحديث المحادثات.' }
  }
}

export async function replyToConversation(id: string, message: string) {
  if (!(await hasResourceAccess('messages', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const text = message.trim()
  if (!text) return { error: 'الرسالة فاضية.' }

  const data = await prisma.messages.findUnique({
    where: { code: id },
    select: { chat_history: true, student_unread: true }
  })

  if (!data) return { error: 'المحادثة غير موجودة.' }

  const history = (data.chat_history ? (typeof data.chat_history === 'string' ? JSON.parse(data.chat_history) : data.chat_history) : []) as ChatMessage[]

  const newMsg: ChatMessage = {
    id: `m${Date.now()}`,
    fromMe: true,
    text,
    time: 'الآن',
  }

  try {
    await prisma.messages.update({
      where: { code: id },
      data: {
        chat_history: JSON.stringify([...history, newMsg]),
        content: text,
        time_label: 'الآن',
        student_unread: (data.student_unread ?? 0) + 1,
        status: 'open',
      }
    })

    logActivity({ action: 'create', resource: 'messages', targetId: id, targetLabel: `رد على محادثة: ${id}` }).catch(() => {})
    revalidatePath('/admin/messages')
    return { success: true, newMsg }
  } catch (error: any) {
    return { error: 'تعذر إرسال الرد.' }
  }
}

export async function setTicketStatus(id: string, status: TicketStatus) {
  if (!(await hasResourceAccess('messages', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.messages.update({
      where: { code: id },
      data: { status }
    })

    logActivity({ action: 'update', resource: 'messages', targetId: id, targetLabel: `حالة تذكرة: ${status}` }).catch(() => {})
    revalidatePath('/admin/messages')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذر تحديث الحالة.' }
  }
}
