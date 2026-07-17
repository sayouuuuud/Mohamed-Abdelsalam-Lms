'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getStudentNotifications, getStudentInvoices } from './actions'

export type StudentSidebarBadges = {
  messages: number
  notifications: number
  billing: number
}

export async function getStudentSidebarBadges(): Promise<StudentSidebarBadges> {
  const session = await auth()
  const user = session?.user
  if (!user) return { messages: 0, notifications: 0, billing: 0 }

  const notifs = await getStudentNotifications()
  const invoices = await getStudentInvoices()

  const msgs = await prisma.messages.findMany({
    where: { student_id: user.id },
    select: { student_unread: true }
  })

  const messages = msgs.filter((m) => (m.student_unread ?? 0) > 0).length
  const notifications = notifs.filter((n: any) => !n.read).length
  const billing = invoices.filter(
    (i) => i.status === 'غير مدفوعة' || i.status === 'مرفوضة',
  ).length

  return { messages, notifications, billing }
}
