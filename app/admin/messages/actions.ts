'use server'

import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
import type { Conversation, ChatMessage, TicketStatus } from '@/lib/messages-data'

export async function getConversations(): Promise<Conversation[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('code, sender_name, subject, content, time_label, unread_count, status, chat_history')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.code,
    name: row.sender_name,
    subject: row.subject || 'تذكرة دعم',
    preview: row.content,
    time: row.time_label,
    unread: row.unread_count ?? 0,
    status: (row.status as TicketStatus) ?? 'open',
    messages: (row.chat_history as ChatMessage[]) ?? [],
  }))
}

export async function markAsRead(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'messages'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase
    .from('messages')
    .update({ unread_count: 0, is_read: true })
    .eq('code', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/messages')
  return { success: true }
}

export async function markAllAsRead() {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'messages'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase
    .from('messages')
    .update({ unread_count: 0, is_read: true })
    .gt('unread_count', 0)

  if (error) return { error: error.message }
  revalidatePath('/admin/messages')
  return { success: true }
}

export async function replyToConversation(id: string, message: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'messages'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const text = message.trim()
  if (!text) return { error: 'الرسالة فاضية.' }

  const { data } = await supabase
    .from('messages')
    .select('chat_history, student_unread')
    .eq('code', id)
    .single()

  if (!data) return { error: 'المحادثة غير موجودة.' }

  const history = (data.chat_history as ChatMessage[]) ?? []

  // fromMe:true → sent BY the admin/teacher.
  const newMsg: ChatMessage = {
    id: `m${Date.now()}`,
    fromMe: true,
    text,
    time: 'الآن',
  }

  const { error } = await supabase
    .from('messages')
    .update({
      chat_history: [...history, newMsg],
      content: text,
      time_label: 'الآن',
      // the teacher just answered, so this becomes unread for the student
      student_unread: (data.student_unread ?? 0) + 1,
      // answering reopens a closed ticket so the thread stays active
      status: 'open',
    })
    .eq('code', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/messages')
  return { success: true, newMsg }
}

export async function setTicketStatus(id: string, status: TicketStatus) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'messages'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase
    .from('messages')
    .update({ status })
    .eq('code', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/messages')
  return { success: true }
}
