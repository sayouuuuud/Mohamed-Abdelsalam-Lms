'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
import {
  computeCouponStatus,
  type CouponRecord,
  type CouponStatus,
  type CouponType,
} from '@/lib/coupons-data'

export async function getCoupons(): Promise<CouponRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('display_code', { ascending: true })

  if (error || !data) return []

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

// All lectures (id + title + branch) for the coupon scope picker.
export async function getAllLectures(): Promise<
  { id: string; title: string; branch: string }[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lectures')
    .select('id, title, branches:branch_id ( title )')
    .order('sort_order', { ascending: true })

  if (error || !data) return []
  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    branch: row.branches?.title ?? '',
  }))
}

// The lecture ids a 'lectures'-scoped coupon currently covers (by display_code).
export async function getCouponLectureIds(displayCode: string): Promise<string[]> {
  const supabase = await createClient()
  const { data: coupon } = await supabase
    .from('coupons')
    .select('id')
    .eq('display_code', displayCode)
    .single()
  if (!coupon) return []
  const { data } = await supabase
    .from('coupon_lectures')
    .select('lecture_id')
    .eq('coupon_id', coupon.id)
  return (data ?? []).map((r: any) => r.lecture_id)
}

// Replaces the coupon_lectures rows for a coupon to match `lectureIds`.
async function syncCouponLectures(
  supabase: Awaited<ReturnType<typeof createClient>>,
  couponId: string,
  scope: string,
  lectureIds: string[],
) {
  await supabase.from('coupon_lectures').delete().eq('coupon_id', couponId)
  if (scope === 'lectures' && lectureIds.length > 0) {
    await supabase
      .from('coupon_lectures')
      .insert(lectureIds.map((lecture_id) => ({ coupon_id: couponId, lecture_id })))
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
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  // Compute the next sequence number numerically. `display_code` is text, so
  // ordering it in the DB would sort lexicographically (e.g. "CPN-09" > "CPN-10")
  // and yield duplicate codes once we reach two digits. Fetch all codes and take
  // the real numeric max instead.
  const { data: existing } = await supabase
    .from('coupons')
    .select('display_code')

  let maxNum = 0
  for (const row of existing ?? []) {
    if (typeof row.display_code === 'string' && row.display_code.startsWith('CPN-')) {
      const num = parseInt(row.display_code.replace('CPN-', ''), 10)
      if (!isNaN(num) && num > maxNum) maxNum = num
    }
  }
  const nextNum = maxNum + 1
  const displayCode = `CPN-${String(nextNum).padStart(2, '0')}`
  const scope = values.scope ?? 'all'

  const { data: created, error } = await supabase
    .from('coupons')
    .insert({
      code: values.code,
      display_code: displayCode,
      description: values.description,
      type: values.type,
      value: values.value,
      "limit": values.limit,
      start_date: values.startDate,
      end_date: values.endDate,
      status: values.status,
      scope,
      used: 0,
    })
    .select('id')
    .single()

  if (error || !created) {
    if (error?.code === '23505') {
      return { error: 'كود الكوبون موجود مسبقاً.' }
    }
    return { error: error?.message ?? 'تعذّر إنشاء الكوبون.' }
  }

  await syncCouponLectures(supabase, created.id, scope, values.lectureIds ?? [])

  revalidatePath('/coupons')
  return { success: true }
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
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const scope = values.scope ?? 'all'

  const { data: updated, error } = await supabase
    .from('coupons')
    .update({
      code: values.code,
      description: values.description,
      type: values.type,
      value: values.value,
      "limit": values.limit,
      start_date: values.startDate,
      end_date: values.endDate,
      status: values.status,
      scope,
    })
    .eq('display_code', id)
    .select('id')
    .single()

  if (error || !updated) {
    if (error?.code === '23505') {
      return { error: 'كود الكوبون موجود مسبقاً.' }
    }
    return { error: error?.message ?? 'تعذّر تحديث الكوبون.' }
  }

  await syncCouponLectures(supabase, updated.id, scope, values.lectureIds ?? [])

  revalidatePath('/coupons')
  return { success: true }
}

export async function deleteCoupon(id: string) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase.from('coupons').delete().eq('display_code', id)
  if (error) return { error: error.message }
  revalidatePath('/coupons')
  return { success: true }
}
