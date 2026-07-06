'use server'

import { createClient } from '@/lib/supabase/server'
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

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export async function getOrders(): Promise<AdminOrder[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, code, student_id, student_name, student_email, student_phone,
       method, reference, note, receipt_url, total, status, created_at,
       order_items ( lecture_title, branch_title, stage_title, price )`,
    )
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row: any) => ({
    id: row.id,
    code: row.code,
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    studentPhone: row.student_phone,
    method: row.method,
    reference: row.reference,
    note: row.note,
    receiptUrl: row.receipt_url ?? '',
    total: Number(row.total),
    status: row.status as OrderStatus,
    createdAt: formatDate(row.created_at),
    items: (row.order_items ?? []).map((i: any) => ({
      title: i.lecture_title,
      branchTitle: i.branch_title,
      stageTitle: i.stage_title,
      price: Number(i.price),
    })),
  }))
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'payments', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  // Fetch order label for audit before updating.
  const { data: orderRow } = await supabase
    .from('orders')
    .select('code, student_name, total')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'update'
  const label = orderRow
    ? `طلب ${orderRow.code} — ${orderRow.student_name} (${orderRow.total} ج.م)`
    : `طلب ID: ${id}`
  logActivity({ action, resource: 'payments', targetId: id, targetLabel: label }).catch(() => {})
  revalidatePath('/payments')
  return { success: true }
}

// Opens (or creates) an internal conversation with the order's student,
// seeded with a greeting that references the order. Returns the conversation code.
export async function messageStudent(orderId: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'payments', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, code, student_id, student_name, total')
    .eq('id', orderId)
    .single()

  if (!order) return { error: 'الطلب غير موجود.' }

  // Existing conversation for this student?
  const { data: existing } = await supabase
    .from('messages')
    .select('code')
    .eq('student_id', order.student_id)
    .limit(1)
    .maybeSingle()

  if (existing?.code) {
    revalidatePath('/messages')
    return { success: true, code: existing.code }
  }

  const greeting = `أهلاً ${order.student_name}، بخصوص طلبك رقم ${order.code} — إحنا بنراجعه وهنرد عليك حالاً لو محتاجين أي تفاصيل.`
  const code = `conv-${String(order.student_id).slice(0, 8)}-${Date.now().toString(36)}`

  const { error } = await supabase.from('messages').insert({
    code,
    student_id: order.student_id,
    sender_name: order.student_name,
    sender_avatar: null,
    subject: `تواصل بخصوص الطلب ${order.code}`,
    content: greeting,
    time_label: 'الآن',
    is_read: true,
    has_attachment: false,
    sender_role: 'student',
    course: '',
    unread_count: 0,
    is_online: false,
    chat_history: [
      { id: `m${Date.now()}`, fromMe: true, text: greeting, time: 'الآن' },
    ],
  })

  if (error) return { error: error.message }
  revalidatePath('/messages')
  return { success: true, code }
}
