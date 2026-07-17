'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { computeCoupon } from '@/app/coupon-actions'
import { auth } from '@/auth'

export type CartItem = {
  lectureId: string | null
  monthlyCourseId: string | null
  termId: string | null
  itemType: 'lecture' | 'course_bundle' | 'term_bundle'
  title: string
  branchTitle: string
  stageTitle: string
  price: number
}

export async function getCartItems(): Promise<CartItem[] | null> {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return null

  const data = await prisma.cart_items.findMany({
    where: { student_id: user.id },
    select: {
      lecture_id: true,
      monthly_course_id: true,
      term_id: true,
      lectures: {
        select: { title: true, price: true, branches: { select: { title: true, stages: { select: { title: true } } } } }
      },
      monthly_courses: {
        select: { title: true, price: true, branches: { select: { title: true, stages: { select: { title: true } } } } }
      },
      terms: {
        select: { title: true, price: true, stages: { select: { title: true } } }
      }
    },
    orderBy: { created_at: 'asc' }
  })

  if (!data) return []

  return data.map((row) => {
    if (row.term_id) {
      const term = row.terms
      return {
        lectureId: null,
        monthlyCourseId: null,
        termId: row.term_id,
        itemType: 'term_bundle' as const,
        title: term?.title ?? '',
        branchTitle: '',
        stageTitle: term?.stages?.title ?? '',
        price: Number(term?.price ?? 0),
      }
    }
    const product = row.lectures ?? row.monthly_courses
    return {
      lectureId: row.lecture_id,
      monthlyCourseId: row.monthly_course_id,
      termId: null,
      itemType: row.monthly_course_id ? 'course_bundle' as const : 'lecture' as const,
      title: product?.title ?? '',
      branchTitle: product?.branches?.title ?? '',
      stageTitle: product?.branches?.stages?.title ?? '',
      price: Number(product?.price ?? 0),
    }
  })
}

function generateOrderCode() {
  const year = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `ORD-${year}-${rand}`
}

export async function addToCart(lectureId: string) {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return { error: 'unauthenticated' as const }

  const lecture = await prisma.lectures.findUnique({
    where: { id: lectureId },
    select: { price: true, title: true, branches: { select: { title: true, stages: { select: { title: true } } } } }
  })

  if (lecture && Number(lecture.price) === 0) {
    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { full_name: true, phone: true, email: true }
    })

    const code = generateOrderCode()
    const order = await prisma.orders.create({
      data: {
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
      },
      select: { id: true }
    })

    if (order) {
      const branchTitle = lecture.branches?.title || ''
      const stageTitle = lecture.branches?.stages?.title || ''

      await prisma.order_items.create({
        data: {
          order_id: order.id,
          lecture_id: lectureId,
          lecture_title: lecture.title,
          branch_title: branchTitle,
          stage_title: stageTitle,
          price: 0,
        }
      })
      revalidatePath('/', 'layout')
      return { success: true, enrolledFree: true }
    }
  }

  try {
    await prisma.cart_items.create({
      data: { student_id: user.id, lecture_id: lectureId }
    })
  } catch (error: any) {
    // ignore unique-violation (already in cart)
    if (error.code !== 'P2002') return { error: error.message }
  }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function addCourseToCart(monthlyCourseId: string) {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return { error: 'unauthenticated' as const }

  const course = await prisma.monthly_courses.findUnique({
    where: { id: monthlyCourseId },
    select: { price: true, title: true, branches: { select: { title: true, stages: { select: { title: true } } } } }
  })

  if (course && Number(course.price) === 0) {
    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { full_name: true, phone: true, email: true }
    })

    const code = generateOrderCode()
    const branchTitle = course.branches?.title || ''
    const stageTitle = course.branches?.stages?.title || ''

    const order = await prisma.orders.create({
      data: {
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
      },
      select: { id: true }
    })

    if (order) {
      await prisma.order_items.create({
        data: {
          order_id: order.id,
          lecture_id: null,
          monthly_course_id: monthlyCourseId,
          item_type: 'course_bundle',
          lecture_title: course.title,
          branch_title: branchTitle,
          stage_title: stageTitle,
          price: 0,
        }
      })
      revalidatePath('/', 'layout')
      return { success: true, enrolledFree: true }
    }
  }

  try {
    await prisma.cart_items.create({
      data: { student_id: user.id, monthly_course_id: monthlyCourseId, lecture_id: null }
    })
  } catch (error: any) {
    if (error.code !== 'P2002') return { error: error.message }
  }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function addTermToCart(termId: string) {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return { error: 'unauthenticated' as const }

  const termCourses = await prisma.monthly_courses.findMany({
    where: { term_id: termId },
    select: { id: true }
  })
  const courseIds = termCourses.map((c) => c.id)
  
  if (courseIds.length > 0) {
    await prisma.cart_items.deleteMany({
      where: { student_id: user.id, monthly_course_id: { in: courseIds } }
    })
  }

  try {
    await prisma.cart_items.create({
      data: { student_id: user.id, term_id: termId, lecture_id: null, monthly_course_id: null }
    })
  } catch (error: any) {
    if (error.code !== 'P2002') return { error: error.message }
  }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeTermFromCart(termId: string) {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return { error: 'unauthenticated' as const }
  await prisma.cart_items.deleteMany({
    where: { student_id: user.id, term_id: termId }
  })
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeCourseFromCart(monthlyCourseId: string) {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return { error: 'unauthenticated' as const }
  try {
    await prisma.cart_items.deleteMany({
      where: { student_id: user.id, monthly_course_id: monthlyCourseId }
    })
  } catch (error: any) {
    return { error: error.message }
  }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeFromCart(lectureId: string) {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return { error: 'unauthenticated' as const }

  try {
    await prisma.cart_items.deleteMany({
      where: { student_id: user.id, lecture_id: lectureId }
    })
  } catch (error: any) {
    return { error: error.message }
  }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getCheckoutDefaults(): Promise<{ name: string; phone: string; email: string }> {
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return { name: '', phone: '', email: '' }

  const data = await prisma.profiles.findUnique({
      where: { id: user.id },
    select: { full_name: true, phone: true, email: true }
  })

  return {
    name: data?.full_name ?? '',
    phone: data?.phone ?? '',
    email: data?.email ?? user.email ?? '',
  }
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
  const session = await auth()
  const user = session?.user
  if (!user || !user.id) return { error: 'unauthenticated' as const }

  const items = await getCartItems()
  if (!items || items.length === 0) return { error: 'السلة فارغة.' }

  const subtotal = items.reduce((sum, i) => sum + i.price, 0)

  let discount = 0
  let appliedCouponCode: string | null = null
  if (input.couponCode?.trim()) {
    const result = await computeCoupon(input.couponCode, items)
    if ('error' in result) return { error: result.error }
    discount = result.applied.discount
    appliedCouponCode = result.applied.code
  }

  const total = Math.max(0, subtotal - discount)
  const code = generateOrderCode()

  try {
    const order = await prisma.orders.create({
      data: {
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
      },
      select: { id: true, code: true }
    })

    if (appliedCouponCode) {
      await prisma.$executeRaw`SELECT increment_coupon_used(${appliedCouponCode})`
    }

    const orderItemRows = items.map((item) => {
      if (item.itemType === 'term_bundle') {
        return {
          order_id: order.id,
          lecture_id: null,
          monthly_course_id: null,
          term_id: item.termId,
          item_type: 'term_bundle',
          lecture_title: item.title,
          branch_title: '',
          stage_title: item.stageTitle,
          price: item.price,
        }
      }
      if (item.monthlyCourseId) {
        return {
          order_id: order.id,
          lecture_id: null,
          monthly_course_id: item.monthlyCourseId,
          term_id: null,
          item_type: 'course_bundle',
          lecture_title: item.title,
          branch_title: item.branchTitle,
          stage_title: item.stageTitle,
          price: item.price,
        }
      }
      return {
        order_id: order.id,
        lecture_id: item.lectureId,
        monthly_course_id: null,
        term_id: null,
        item_type: 'lecture',
        lecture_title: item.title,
        branch_title: item.branchTitle,
        stage_title: item.stageTitle,
        price: item.price,
      }
    })

    await prisma.order_items.createMany({ data: orderItemRows })

    await prisma.cart_items.deleteMany({
      where: { student_id: user.id }
    })

    revalidatePath('/', 'layout')
    return { success: true, code: order.code }
  } catch (orderErr: any) {
    return { error: orderErr?.message ?? 'تعذّر إنشاء الطلب.' }
  }
}
