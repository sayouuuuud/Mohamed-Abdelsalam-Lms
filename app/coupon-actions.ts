'use server'

import { prisma } from '@/lib/prisma'
import { getCartItems, type CartItem } from '@/app/cart-actions'

export type AppliedCoupon = {
  code: string
  displayCode: string
  type: 'نسبة مئوية' | 'مبلغ ثابت'
  value: number
  scope: 'all' | 'lectures'
  subtotal: number
  discount: number
  total: number
  coveredCount: number
  itemsCount: number
}

type CouponRow = {
  id: string
  code: string
  display_code: string
  type: 'نسبة مئوية' | 'مبلغ ثابت'
  value: number
  used: number
  limit: number
  start_date: string | null
  end_date: string | null
  status: string
  scope: 'all' | 'lectures'
}

export async function computeCoupon(
  rawCode: string,
  items: CartItem[],
): Promise<
  | { error: string }
  | { applied: AppliedCoupon; row: CouponRow; coveredIds: Set<string> }
> {
  const code = rawCode.trim()
  if (!code) return { error: 'اكتب كود الكوبون.' }
  if (!items.length) return { error: 'السلة فارغة.' }

  const rowData = await prisma.coupons.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } }
  })

  if (!rowData) return { error: 'كود الكوبون غير صحيح.' }

  const row = {
    id: rowData.id,
    code: rowData.code,
    display_code: rowData.display_code,
    type: rowData.type as 'نسبة مئوية' | 'مبلغ ثابت',
    value: Number(rowData.value),
    used: rowData.used ?? 0,
    limit: rowData.limit ?? 0,
    start_date: rowData.start_date ? rowData.start_date.toISOString().slice(0, 10) : null,
    end_date: rowData.end_date ? rowData.end_date.toISOString().slice(0, 10) : null,
    status: rowData.status,
    scope: rowData.scope as 'all' | 'lectures',
  }

  if (row.status !== 'نشط') return { error: 'الكوبون ده مش فعّال حالياً.' }

  const today = new Date().toISOString().slice(0, 10)
  if (row.start_date && today < row.start_date)
    return { error: 'الكوبون ده لسه ماشتغلش.' }
  if (row.end_date && today > row.end_date)
    return { error: 'الكوبون ده انتهت صلاحيته.' }

  if (row.limit > 0 && row.used >= row.limit)
    return { error: 'الكوبون ده وصل للحد الأقصى للاستخدام.' }

  const subtotal = items.reduce((sum, i) => sum + i.price, 0)

  let coveredIds = new Set<string>()
  let base = subtotal
  if (row.scope === 'lectures') {
    const links = await prisma.coupon_lectures.findMany({
      where: { coupon_id: row.id },
      select: { lecture_id: true }
    })
    coveredIds = new Set(links.map((l) => l.lecture_id))
    const covered = items.filter((i) => i.lectureId && coveredIds.has(i.lectureId))
    if (covered.length === 0)
      return { error: 'الكوبون ده مش بينطبق على أي محاضرة في سلتك.' }
    base = covered.reduce((sum, i) => sum + i.price, 0)
  } else {
    coveredIds = new Set(items.flatMap((i) => i.lectureId ? [i.lectureId] : []))
  }

  let discount =
    row.type === 'نسبة مئوية' ? (base * row.value) / 100 : Math.min(row.value, base)
  discount = Math.round(Math.min(discount, base) * 100) / 100

  const coveredCount = items.filter((i) => i.lectureId && coveredIds.has(i.lectureId)).length

  return {
    applied: {
      code: row.code,
      displayCode: row.display_code,
      type: row.type,
      value: row.value,
      scope: row.scope,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      coveredCount,
      itemsCount: items.length,
    },
    row,
    coveredIds,
  }
}

export async function applyCoupon(
  code: string,
): Promise<{ error: string } | { applied: AppliedCoupon }> {
  const items = await getCartItems()
  if (!items) return { error: 'سجّل دخولك الأول.' }

  const result = await computeCoupon(code, items)
  if ('error' in result) return { error: result.error }
  return { applied: result.applied }
}
