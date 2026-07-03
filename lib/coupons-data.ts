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

export const couponRecords: CouponRecord[] = [
  {
    id: 'CPN-01',
    code: 'WELCOME25',
    description: 'خصم ترحيبي للطلاب الجدد على أول كورس',
    type: 'نسبة مئوية',
    value: 25,
    used: 320,
    limit: 500,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    status: 'نشط',
  },
  {
    id: 'CPN-02',
    code: 'RAMADAN50',
    description: 'عرض شهر رمضان على جميع كورسات البرمجة',
    type: 'نسبة مئوية',
    value: 50,
    used: 870,
    limit: 1000,
    startDate: '2025-03-01',
    endDate: '2025-03-30',
    status: 'منتهي',
  },
  {
    id: 'CPN-03',
    code: 'SAVE100',
    description: 'خصم 100 جنيه على الكورسات فوق 500 جنيه',
    type: 'مبلغ ثابت',
    value: 100,
    used: 145,
    limit: 300,
    startDate: '2025-06-01',
    endDate: '2025-09-30',
    status: 'نشط',
  },
  {
    id: 'CPN-04',
    code: 'DESIGN30',
    description: 'خصم على باقة كورسات التصميم',
    type: 'نسبة مئوية',
    value: 30,
    used: 60,
    limit: 200,
    startDate: '2025-05-15',
    endDate: '2025-08-15',
    status: 'نشط',
  },
  {
    id: 'CPN-05',
    code: 'SUMMER15',
    description: 'خصم الصيف على كورسات اللغات',
    type: 'نسبة مئوية',
    value: 15,
    used: 200,
    limit: 200,
    startDate: '2025-06-01',
    endDate: '2025-08-31',
    status: 'متوقف',
  },
  {
    id: 'CPN-06',
    code: 'VIP200',
    description: 'خصم 200 جنيه لأعضاء البرنامج المميز',
    type: 'مبلغ ثابت',
    value: 200,
    used: 38,
    limit: 100,
    startDate: '2025-04-01',
    endDate: '2025-12-31',
    status: 'نشط',
  },
]
