'use server'

import { createClient } from '@/lib/supabase/server'
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
  coveredCount: number // how many cart items the coupon applied to
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
  start_date: string
  end_date: string
  status: string
  scope: 'all' | 'lectures'
}

/**
 * Validates a coupon against the given cart items and computes the discount.
 * Shared by the cart preview (applyCoupon) and checkout (createOrder) so both
 * agree on the number. Returns either { error } or the computed AppliedCoupon
 * (plus the raw row + covered lecture ids for the caller).
 */
export async function computeCoupon(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawCode: string,
  items: CartItem[],
): Promise<
  | { error: string }
  | { applied: AppliedCoupon; row: CouponRow; coveredIds: Set<string> }
> {
  const code = rawCode.trim()
  if (!code) return { error: 'اكتب كود الكوبون.' }
  if (!items.length) return { error: 'السلة فارغة.' }

  // Match the code case-insensitively (codes are stored as typed, e.g. WELCOME25).
  const { data: rows } = await supabase
    .from('coupons')
    .select(
      'id, code, display_code, type, value, used, "limit", start_date, end_date, status, scope',
    )
    .ilike('code', code)
    .limit(1)

  const row = rows?.[0] as CouponRow | undefined
  if (!row) return { error: 'كود الكوبون غير صحيح.' }

  if (row.status !== 'نشط') return { error: 'الكوبون ده مش فعّال حالياً.' }

  const today = new Date().toISOString().slice(0, 10)
  if (row.start_date && today < row.start_date)
    return { error: 'الكوبون ده لسه ماشتغلش.' }
  if (row.end_date && today > row.end_date)
    return { error: 'الكوبون ده انتهت صلاحيته.' }

  if (row.limit > 0 && row.used >= row.limit)
    return { error: 'الكوبون ده وصل للحد الأقصى للاستخدام.' }

  const subtotal = items.reduce((sum, i) => sum + i.price, 0)

  // Determine the base the discount applies to.
  let coveredIds = new Set<string>()
  let base = subtotal
  if (row.scope === 'lectures') {
    const { data: links } = await supabase
      .from('coupon_lectures')
      .select('lecture_id')
      .eq('coupon_id', row.id)
    coveredIds = new Set((links ?? []).map((l: any) => l.lecture_id))
    const covered = items.filter((i) => i.lectureId && coveredIds.has(i.lectureId))
    if (covered.length === 0)
      return { error: 'الكوبون ده مش بينطبق على أي محاضرة في سلتك.' }
    base = covered.reduce((sum, i) => sum + i.price, 0)
  } else {
    coveredIds = new Set(items.flatMap((i) => i.lectureId ? [i.lectureId] : []))
  }

  // Compute discount, capped so the total never goes below zero.
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

/**
 * Cart-preview entry point: validates a coupon against the signed-in student's
 * current cart and returns the computed totals (no DB writes).
 */
export async function applyCoupon(
  code: string,
): Promise<{ error: string } | { applied: AppliedCoupon }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'سجّل دخولك الأول.' }

  const items = await getCartItems()
  if (!items) return { error: 'سجّل دخولك الأول.' }

  const result = await computeCoupon(supabase, code, items)
  if ('error' in result) return { error: result.error }
  return { applied: result.applied }
}
