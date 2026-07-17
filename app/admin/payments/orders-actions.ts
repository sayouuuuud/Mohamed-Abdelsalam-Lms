'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit-log'

export type OrderStatus = 'pending' | 'approved' | 'rejected'

export type AdminOrderItem = {
  title: string
  branchTitle: string
  stageTitle: string
  price: number
}

export type AdminOrder = {
  id: string
  code: string
  studentId: string
  studentName: string
  studentEmail: string
  studentPhone: string
  method: string
  reference: string
  note: string
  receiptUrl: string
  total: number
  status: OrderStatus
  createdAt: string
  items: AdminOrderItem[]
}

function formatDate(iso: string | Date) {
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return String(iso)
  }
}

export async function getOrders(): Promise<AdminOrder[]> {
  const data = await prisma.orders.findMany({
    include: { order_items: true },
    orderBy: { created_at: 'desc' }
  })

  return data.map((row) => ({
    id: row.id,
    code: row.code,
    studentId: row.student_id,
    studentName: row.student_name ?? '',
    studentEmail: row.student_email ?? '',
    studentPhone: row.student_phone ?? '',
    method: row.method ?? '',
    reference: row.reference ?? '',
    note: row.note ?? '',
    receiptUrl: row.receipt_url ?? '',
    total: Number(row.total),
    status: (row.status ?? 'pending') as OrderStatus,
    createdAt: formatDate(row.created_at),
    items: row.order_items.map((i) => ({
      title: i.lecture_title ?? '',
      branchTitle: i.branch_title ?? '',
      stageTitle: i.stage_title ?? '',
      price: Number(i.price),
    })),
  }))
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  if (!(await hasResourceAccess('payments', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const orderRow = await prisma.orders.findUnique({
    where: { id },
    select: { code: true, student_name: true, total: true }
  })

  try {
    await prisma.orders.update({
      where: { id },
      data: { status }
    })

    const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'update'
    const label = orderRow
      ? `طلب ${orderRow.code} — ${orderRow.student_name} (${orderRow.total} ج.م)`
      : `طلب ID: ${id}`
    logActivity({ action, resource: 'payments', targetId: id, targetLabel: label }).catch(() => {})
    revalidatePath('/payments')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذر تحديث الطلب.' }
  }
}

export async function messageStudent(orderId: string) {
  if (!(await hasResourceAccess('payments', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { id: true, code: true, student_id: true, student_name: true, total: true }
  })

  if (!order) return { error: 'الطلب غير موجود.' }

  const existing = await prisma.messages.findFirst({
    where: { student_id: order.student_id },
    select: { code: true }
  })

  if (existing?.code) {
    revalidatePath('/messages')
    return { success: true, code: existing.code }
  }

  const greeting = `أهلاً ${order.student_name}، بخصوص طلبك رقم ${order.code} — إحنا بنراجعه وهنرد عليك حالاً لو محتاجين أي تفاصيل.`
  const code = `conv-${String(order.student_id).slice(0, 8)}-${Date.now().toString(36)}`

  try {
    await prisma.messages.create({
      data: {
        code,
        student_id: order.student_id,
        sender_name: order.student_name ?? '',
        subject: `تواصل بخصوص الطلب ${order.code}`,
        content: greeting,
        time_label: 'الآن',
        is_read: true,
        sender_role: 'student',
        unread_count: 0,
        chat_history: JSON.stringify([
          { id: `m${Date.now()}`, fromMe: true, text: greeting, time: 'الآن' },
        ]),
        status: 'open',
      }
    })

    revalidatePath('/messages')
    return { success: true, code }
  } catch (error: any) {
    return { error: 'تعذر بدء المحادثة.' }
  }
}
