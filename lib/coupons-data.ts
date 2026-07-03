export type CouponStatus = 'نشط' | 'منتهي' | 'متوقف'
export type CouponType = 'نسبة مئوية' | 'مبلغ ثابت'
export type CouponScope = 'all' | 'lectures'

/**
 * الحالة الفعلية للكوبون تُحسب من التاريخ + قرار الأدمن اليدوي:
 * - "متوقف" (إيقاف يدوي) له الأولوية دائماً.
 * - لو تاريخ الانتهاء عدّى → "منتهي" تلقائياً.
 * - غير كده → "نشط".
 * `storedStatus` هو ما حفظه الأدمن (نشط/متوقف). "منتهي" حالة محسوبة فقط.
 */
export function computeCouponStatus(
  storedStatus: CouponStatus,
  endDate: string,
): CouponStatus {
  if (storedStatus === 'متوقف') return 'متوقف'
  const end = new Date(endDate)
  if (!isNaN(end.getTime())) {
    // نهاية اليوم المذكور تُعتبر ضمن الصلاحية
    end.setHours(23, 59, 59, 999)
    if (end.getTime() < Date.now()) return 'منتهي'
  }
  return 'نشط'
}

export type CouponRecord = {
  id: string
  code: string
  description: string
  type: CouponType
  // discount value: percentage (0-100) or fixed amount in EGP
  value: number
  used: number
  limit: number
  startDate: string
  endDate: string
  status: CouponStatus
  // 'all' = whole cart; 'lectures' = only the linked lectures
  scope?: CouponScope
}


