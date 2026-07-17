'use server'

import { prisma } from '@/lib/prisma'
import { isStaff } from '@/lib/auth-guard'

export type AdminSidebarBadges = {
  orders: number
  messages: number
  notifications: number
}

export async function getAdminSidebarBadges(): Promise<AdminSidebarBadges> {
  if (!(await isStaff())) {
    return { orders: 0, messages: 0, notifications: 0 }
  }

  const [orders, messages, notifications] = await Promise.all([
    prisma.orders.count({ where: { status: 'pending' } }),
    prisma.messages.count({ where: { unread_count: { gt: 0 } } }),
    prisma.notifications.count({ where: { read: false } }),
  ])

  return { orders, messages, notifications }
}
