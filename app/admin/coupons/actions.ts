'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit-log'
import {
  computeCouponStatus,
  type CouponRecord,
  type CouponStatus,
  type CouponType,
} from '@/lib/coupons-data'

export async function getCoupons(): Promise<CouponRecord[]> {
  const data = await prisma.coupons.findMany({
    orderBy: { created_at: 'desc' }
  })

  return data.map((row) => ({
    id: row.display_code,
    code: row.code,
    description: row.description,
    type: row.type as CouponType,
    value: row.value,
    used: row.used,
    limit: row.limit,
    startDate: row.start_date,
    endDate: row.end_date,
    status: computeCouponStatus(row.status as CouponStatus, row.end_date),
    scope: (row.scope ?? 'all') as 'all' | 'lectures',
  }))
}

export async function getAllLectures(): Promise<{ id: string; title: string; branch: string }[]> {
  const data = await prisma.lectures.findMany({
    select: { id: true, title: true, branches: { select: { title: true } } },
    orderBy: { sort_order: 'asc' }
  })

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    branch: row.branches?.title ?? '',
  }))
}

export async function getCouponLectureIds(displayCode: string): Promise<string[]> {
  const coupon = await prisma.coupons.findUnique({
    where: { display_code: displayCode },
    select: { id: true }
  })
  if (!coupon) return []

  const data = await prisma.coupon_lectures.findMany({
    where: { coupon_id: coupon.id },
    select: { lecture_id: true }
  })
  return data.map((r) => r.lecture_id)
}

async function syncCouponLectures(couponId: string, scope: string, lectureIds: string[]) {
  await prisma.coupon_lectures.deleteMany({ where: { coupon_id: couponId } })
  if (scope === 'lectures' && lectureIds.length > 0) {
    await prisma.coupon_lectures.createMany({
      data: lectureIds.map((lecture_id) => ({ coupon_id: couponId, lecture_id }))
    })
  }
}

export async function createCoupon(values: {
  code: string
  description: string
  type: string
  value: number
  limit: number
  startDate: string
  endDate: string
  status: string
  scope?: 'all' | 'lectures'
  lectureIds?: string[]
}) {
  if (!(await hasResourceAccess('coupons', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const existing = await prisma.coupons.findMany({ select: { display_code: true } })

  let maxNum = 0
  for (const row of existing) {
    if (typeof row.display_code === 'string' && row.display_code.startsWith('CPN-')) {
      const num = parseInt(row.display_code.replace('CPN-', ''), 10)
      if (!isNaN(num) && num > maxNum) maxNum = num
    }
  }
  const nextNum = maxNum + 1
  const displayCode = `CPN-${String(nextNum).padStart(2, '0')}`
  const scope = values.scope ?? 'all'

  try {
    const created = await prisma.coupons.create({
      data: {
        code: values.code,
        display_code: displayCode,
        description: values.description,
        type: values.type,
        value: values.value,
        limit: values.limit,
        start_date: new Date(values.startDate).toISOString(),
        end_date: new Date(values.endDate).toISOString(),
        status: values.status,
        scope,
        used: 0,
      },
      select: { id: true }
    })

    await syncCouponLectures(created.id, scope, values.lectureIds ?? [])

    logActivity({ action: 'create', resource: 'coupons', targetId: displayCode, targetLabel: `كوبون: ${displayCode} (${values.value}%)` }).catch(() => {})
    revalidatePath('/coupons')
    return { success: true }
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { error: 'كود الكوبون موجود مسبقاً.' }
    }
    return { error: error?.message ?? 'تعذّر إنشاء الكوبون.' }
  }
}

export async function updateCoupon(
  id: string,
  values: {
    code: string
    description: string
    type: string
    value: number
    limit: number
    startDate: string
    endDate: string
    status: string
    scope?: 'all' | 'lectures'
    lectureIds?: string[]
  },
) {
  if (!(await hasResourceAccess('coupons', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const scope = values.scope ?? 'all'

  try {
    const updated = await prisma.coupons.update({
      where: { display_code: id },
      data: {
        code: values.code,
        description: values.description,
        type: values.type,
        value: values.value,
        limit: values.limit,
        start_date: new Date(values.startDate).toISOString(),
        end_date: new Date(values.endDate).toISOString(),
        status: values.status,
        scope,
      },
      select: { id: true }
    })

    await syncCouponLectures(updated.id, scope, values.lectureIds ?? [])

    logActivity({ action: 'update', resource: 'coupons', targetId: id, targetLabel: `كوبون: ${id}` }).catch(() => {})
    revalidatePath('/coupons')
    return { success: true }
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { error: 'كود الكوبون موجود مسبقاً.' }
    }
    return { error: error?.message ?? 'تعذّر تحديث الكوبون.' }
  }
}

export async function deleteCoupon(id: string) {
  if (!(await hasResourceAccess('coupons', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.coupons.delete({ where: { display_code: id } })
    logActivity({ action: 'delete', resource: 'coupons', targetId: id, targetLabel: `كوبون: ${id}` }).catch(() => {})
    revalidatePath('/coupons')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
