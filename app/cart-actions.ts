'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeCoupon } from '@/app/coupon-actions'

export type CartItem = {
  lectureId: string | null
  monthlyCourseId: string | null
  itemType: 'lecture' | 'course_bundle'
  title: string
  branchTitle: string
  stageTitle: string
  price: number
}

// Returns the signed-in student's cart (joined with lecture/branch/stage info).
// Returns null when the visitor is not logged in.
export async function getCartItems(): Promise<CartItem[] | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('cart_items')
    .select(
      `lecture_id, monthly_course_id,
       lectures:lecture_id (
         title, price,
         branches:branch_id ( title, stages:stage_id ( title ) )
       ),
       monthly_courses:monthly_course_id (
         title, price,
         branches:branch_id ( title, stages:stage_id ( title ) )
       )`,
    )
    .eq('student_id', user.id)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row: any) => {
    const product = row.lectures ?? row.monthly_courses
    return {
      lectureId: row.lecture_id,
      monthlyCourseId: row.monthly_course_id,
      itemType: row.monthly_course_id ? 'course_bundle' as const : 'lecture' as const,
      title: product?.title ?? '',
      branchTitle: product?.branches?.title ?? '',
      stageTitle: product?.branches?.stages?.title ?? '',
      price: Number(product?.price ?? 0),
    }
  })
}

export async function addToCart(lectureId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' as const }

  // Check if lecture is free
  const { data: lecture } = await supabase
    .from('lectures')
    .select(`
      price, title,
      branches:branch_id ( title, stages:stage_id ( title ) )
    `)
    .eq('id', lectureId)
    .single()

  if (lecture && Number(lecture.price) === 0) {
    // Auto-enroll!
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', user.id)
      .single()

    const code = generateOrderCode()
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        code,
        student_id: user.id,
        student_name: profile?.full_name || 'طالب',
        student_email: profile?.email || user.email || '',
        student_phone: profile?.phone || '',
        method: 'مجاني',
        reference: '',
        note: '',
        subtotal: 0,
        discount: 0,
        coupon_code: null,
        total: 0,
        status: 'approved',
      })
      .select('id')
      .single()

    if (!orderErr && order) {
      // TypeScript safety for nested relations
      const branchTitle = (lecture.branches as any)?.title || ''
      const stageTitle = (lecture.branches as any)?.stages?.title || ''

      await supabase.from('order_items').insert({
        order_id: order.id,
        lecture_id: lectureId,
        lecture_title: lecture.title,
        branch_title: branchTitle,
        stage_title: stageTitle,
        price: 0,
      })
      revalidatePath('/', 'layout')
      return { success: true, enrolledFree: true }
    }
  }

  const { error } = await supabase
    .from('cart_items')
    .insert({ student_id: user.id, lecture_id: lectureId })

  // ignore unique-violation (already in cart)
  if (error && error.code !== '23505') return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function addCourseToCart(monthlyCourseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' as const }

  // If the course is free, auto-enroll immediately without going through the cart.
  const { data: course } = await supabase
    .from('monthly_courses')
    .select(`price, title, branches:branch_id ( title, stages:stage_id ( title ) )`)
    .eq('id', monthlyCourseId)
    .single()

  if (course && Number(course.price) === 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', user.id)
      .single()

    const code = generateOrderCode()
    const branchTitle = (course.branches as any)?.title || ''
    const stageTitle = (course.branches as any)?.stages?.title || ''

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        code,
        student_id: user.id,
        student_name: profile?.full_name || 'طالب',
        student_email: profile?.email || user.email || '',
        student_phone: profile?.phone || '',
        method: 'مجاني',
        reference: '',
        note: '',
        subtotal: 0,
        discount: 0,
        coupon_code: null,
        total: 0,
        status: 'approved',
      })
      .select('id')
      .single()

    if (!orderErr && order) {
      await supabase.from('order_items').insert({
        order_id: order.id,
        lecture_id: null,
        monthly_course_id: monthlyCourseId,
        item_type: 'course_bundle',
        lecture_title: course.title,
        branch_title: branchTitle,
        stage_title: stageTitle,
        price: 0,
      })
      revalidatePath('/', 'layout')
      return { success: true, enrolledFree: true }
    }
  }

  const { error } = await supabase.from('cart_items').insert({
    student_id: user.id,
    monthly_course_id: monthlyCourseId,
    lecture_id: null,
  })
  if (error && error.code !== '23505') return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeCourseFromCart(monthlyCourseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' as const }
  const { error } = await supabase.from('cart_items').delete().eq('student_id', user.id).eq('monthly_course_id', monthlyCourseId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeFromCart(lectureId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' as const }

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('student_id', user.id)
    .eq('lecture_id', lectureId)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getCheckoutDefaults(): Promise<{ name: string; phone: string; email: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { name: '', phone: '', email: '' }

  const { data } = await supabase
    .from('profiles')
    .select('full_name, phone, email')
    .eq('id', user.id)
    .single()

  return {
    name: data?.full_name ?? '',
    phone: data?.phone ?? '',
    email: data?.email ?? user.email ?? '',
  }
}

function generateOrderCode() {
  const year = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `ORD-${year}-${rand}`
}

export async function createOrder(input: {
  name: string
  phone: string
  method: string
  reference?: string
  note?: string
  receiptUrl?: string
  couponCode?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' as const }

  const items = await getCartItems()
  if (!items || items.length === 0) return { error: 'السلة فارغة.' }

  const subtotal = items.reduce((sum, i) => sum + i.price, 0)

  // Re-validate the coupon server-side (never trust a client-sent discount).
  let discount = 0
  let appliedCouponCode: string | null = null
  if (input.couponCode?.trim()) {
    const result = await computeCoupon(supabase, input.couponCode, items)
    if ('error' in result) return { error: result.error }
    discount = result.applied.discount
    appliedCouponCode = result.applied.code
  }

  const total = Math.max(0, subtotal - discount)
  const code = generateOrderCode()

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      code,
      student_id: user.id,
      student_name: input.name,
      student_email: user.email ?? '',
      student_phone: input.phone,
      method: input.method,
      reference: input.reference ?? '',
      note: input.note ?? '',
      receipt_url: input.receiptUrl ?? null,
      subtotal,
      discount,
      coupon_code: appliedCouponCode,
      total,
      status: 'pending',
    })
    .select('id, code')
    .single()

  if (orderErr || !order) return { error: orderErr?.message ?? 'تعذّر إنشاء الطلب.' }

  // Increment coupon usage (best-effort; doesn't fail the order). Uses a
  // SECURITY DEFINER RPC because coupons are admin-only for writes under RLS.
  if (appliedCouponCode) {
    await supabase.rpc('increment_coupon_used', { p_code: appliedCouponCode })
  }

  // Course bundles are stored as a single `course_bundle` row. Access to the
  // bundle's lectures (current and future) is derived dynamically at read time
  // in getPurchasedLectureIds, so we intentionally do NOT freeze a per-lecture
  // snapshot here.
  const orderItemRows = items.map((item) =>
    item.monthlyCourseId
      ? {
          order_id: order.id,
          lecture_id: null,
          monthly_course_id: item.monthlyCourseId,
          item_type: 'course_bundle',
          lecture_title: item.title,
          branch_title: item.branchTitle,
          stage_title: item.stageTitle,
          price: item.price,
        }
      : {
          order_id: order.id,
          lecture_id: item.lectureId,
          monthly_course_id: null,
          item_type: 'lecture',
          lecture_title: item.title,
          branch_title: item.branchTitle,
          stage_title: item.stageTitle,
          price: item.price,
        },
  )

  const { error: itemsErr } = await supabase.from('order_items').insert(orderItemRows)
  if (itemsErr) return { error: itemsErr.message }

  // clear the cart after a successful order
  await supabase.from('cart_items').delete().eq('student_id', user.id)

  revalidatePath('/', 'layout')
  return { success: true, code: order.code }
}
