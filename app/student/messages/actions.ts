'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentStudent } from '@/lib/auth-guard'
import { auth } from '@/auth'
import type { Conversation, ChatMessage, TicketStatus } from '@/lib/student-messages-data'

const TEACHER_NAME = 'أ. عبد السلام'
const TEACHER_ROLE = 'المدرّس وفريق الدعم'
const TEACHER_INITIALS = 'ع'

function toStudentMessages(history: any): ChatMessage[] {
  if (!Array.isArray(history)) return []
  return history.map((m: any, i: number) => ({
    id: m.id ?? `m${i}`,
    fromMe: !m.fromMe,
    text: m.text ?? '',
    time: m.time ?? '',
  }))
}

export async function getStudentConversations(): Promise<Conversation[]> {
  const student = await getCurrentStudent()
  const session = await auth()
  const user = session?.user
  if (!user || !student) return []

  const rows = await prisma.messages.findMany({
    where: { student_id: user.id as string },
    select: { code: true, subject: true, content: true, time_label: true, chat_history: true, status: true, student_unread: true },
    orderBy: { created_at: 'desc' }
  })

  return rows.map((row) => ({
    id: row.code,
    name: TEACHER_NAME,
    role: TEACHER_ROLE,
    initials: TEACHER_INITIALS,
    subject: row.subject ?? 'تذكرة دعم',
    status: (row.status as TicketStatus) ?? 'open',
    lastTime: row.time_label ?? '',
    unread: row.student_unread ?? 0,
    messages: toStudentMessages(row.chat_history),
  }))
}

export async function startConversation(subject: string, text: string) {
  const message = text.trim()
  if (!message) return { error: 'اكتب رسالتك الأول.' }

  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'لازم تسجّل دخول.' }

  const profile = await prisma.profiles.findUnique({
    where: { id: user.id as string },
    select: { full_name: true }
  })
  const studentName = profile?.full_name || user.email || 'طالب'

  const newMsg = { id: `m${Date.now()}`, fromMe: false, text: message, time: 'الآن' }
  const code = `ticket-${(user.id as string).slice(0, 8)}-${Date.now().toString(36)}`

  await prisma.messages.create({
    data: {
      code,
      student_id: user.id as string,
      sender_name: studentName,
      subject: subject.trim() || 'تذكرة دعم',
      content: message,
      time_label: 'الآن',
      is_read: false,
      has_attachment: false,
      sender_role: 'student',
      unread_count: 1,
      student_unread: 0,
      is_online: false,
      status: 'open',
      chat_history: [newMsg],
    }
  })

  revalidatePath('/student/messages')
  return { success: true, code }
}

export async function sendStudentMessage(code: string, text: string) {
  const message = text.trim()
  if (!message) return { error: 'الرسالة فاضية.' }

  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'لازم تسجّل دخول.' }

  const convo = await prisma.messages.findFirst({
    where: { code, student_id: user.id as string },
    select: { id: true, chat_history: true, unread_count: true }
  })

  if (!convo) return { error: 'التذكرة غير موجودة.' }

  const newMsg = { id: `m${Date.now()}`, fromMe: false, text: message, time: 'الآن' }
  const history = Array.isArray(convo.chat_history) ? convo.chat_history : []

  await prisma.messages.update({
    where: { id: convo.id },
    data: {
      chat_history: [...history, newMsg] as any,
      content: message,
      time_label: 'الآن',
      unread_count: (convo.unread_count ?? 0) + 1,
      status: 'open',
    }
  })

  revalidatePath('/student/messages')
  return { success: true }
}

export async function markTicketRead(code: string) {
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'لازم تسجّل دخول.' }

  const convo = await prisma.messages.findFirst({
    where: { code, student_id: user.id as string },
    select: { id: true }
  })

  if (!convo) return { success: true }

  await prisma.messages.update({
    where: { id: convo.id },
    data: { student_unread: 0 }
  })

  revalidatePath('/student/messages')
  return { success: true }
}
