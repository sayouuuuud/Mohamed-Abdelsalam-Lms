'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import type { Invoice, InvoiceStatus, PaymentMethod } from '@/lib/student-billing-data'

function mapOrderStatus(status: string): InvoiceStatus {
  switch (status) {
    case 'approved': return 'مدفوعة'
    case 'rejected': return 'مرفوضة'
    default: return 'قيد المراجعة'
  }
}

function formatPaymentDate(date: string | Date): string {
  try {
    return new Date(date).toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return String(date)
  }
}

const asPaymentMethod = (m: string | null): PaymentMethod | undefined =>
  m === 'انستاباي' || m === 'فودافون كاش' ? m : undefined

export async function getStudentInvoices(): Promise<Invoice[]> {
  const session = await auth()
  const user = session?.user
  if (!user) return []

  const orderRows = await prisma.orders.findMany({
    where: { student_id: user.id },
    select: {
      code: true,
      method: true,
      reference: true,
      note: true,
      total: true,
      status: true,
      created_at: true,
      order_items: {
        select: { lecture_title: true }
      }
    },
    orderBy: { created_at: 'desc' }
  })

  return orderRows.map((row) => {
    const titles = row.order_items
      .map((i) => i.lecture_title)
      .filter((t): t is string => !!t)
    const course =
      titles.length === 0
        ? 'طلب شراء'
        : titles.length === 1
          ? titles[0]
          : `${titles[0]} +${titles.length - 1} كورس`

    return {
      id: row.code,
      course,
      instructor: '',
      amount: Number(row.total) || 0,
      issuedAt: formatPaymentDate(row.created_at),
      dueDate: formatPaymentDate(row.created_at),
      status: mapOrderStatus(row.status),
      method: asPaymentMethod(row.method),
      reference: row.reference || undefined,
      submittedAt:
        row.status === 'pending' ? formatPaymentDate(row.created_at) : undefined,
      rejectionReason:
        row.status === 'rejected' ? row.note || undefined : undefined,
    }
  })
}

export async function resubmitPayment(
  code: string,
  method: PaymentMethod,
  reference: string,
) {
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'غير مسجّل الدخول.' }

  await prisma.orders.updateMany({
    where: {
      code,
      student_id: user.id
    },
    data: {
      method,
      reference,
      status: 'pending'
    }
  })

  revalidatePath('/student/billing')
  return { success: true }
}
