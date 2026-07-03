'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  computeCouponStatus,
  type CouponRecord,
  type CouponStatus,
  type CouponType,
  type CouponScope,
} from '@/lib/coupons-data'
import { createCoupon, updateCoupon, deleteCoupon } from '@/app/admin/coupons/actions'

export type LectureOption = { id: string; title: string; branch: string }

export type CouponFormValues = {
  code: string
  description: string
  type: CouponType
  value: number
  limit: number
  startDate: string
  endDate: string
  status: CouponStatus
  scope: CouponScope
  lectureIds: string[]
}

type CouponsContextValue = {
  coupons: CouponRecord[]
  lectures: LectureOption[]
  openCreate: () => void
  openEdit: (coupon: CouponRecord) => void
  requestDelete: (coupon: CouponRecord) => void
  formOpen: boolean
  editing: CouponRecord | null
  closeForm: () => void
  submitForm: (values: CouponFormValues) => void
  deleting: CouponRecord | null
  closeDelete: () => void
  confirmDelete: () => void
}

const CouponsContext = createContext<CouponsContextValue | null>(null)

export function useCoupons() {
  const ctx = useContext(CouponsContext)
  if (!ctx) throw new Error('useCoupons must be used within CouponsProvider')
  return ctx
}

export function CouponsProvider({
  children,
  initialCoupons,
  lectures = [],
}: {
  children: ReactNode
  initialCoupons: CouponRecord[]
  lectures?: LectureOption[]
}) {
  const router = useRouter()
  const [coupons, setCoupons] = useState<CouponRecord[]>(initialCoupons)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CouponRecord | null>(null)
  const [deleting, setDeleting] = useState<CouponRecord | null>(null)

  const value = useMemo<CouponsContextValue>(
    () => ({
      coupons,
      lectures,
      openCreate: () => {
        setEditing(null)
        setFormOpen(true)
      },
      openEdit: (coupon) => {
        setEditing(coupon)
        setFormOpen(true)
      },
      requestDelete: (coupon) => setDeleting(coupon),
      formOpen,
      editing,
      closeForm: () => setFormOpen(false),
      submitForm: async (values) => {
        if (editing) {
          const original = [...coupons]
          setCoupons((prev) =>
            prev.map((c) =>
              c.id === editing.id
                ? {
                    ...c,
                    ...values,
                    status: computeCouponStatus(values.status, values.endDate),
                  }
                : c,
            ),
          )
          setFormOpen(false)
          setEditing(null)
          
          const res = await updateCoupon(editing.id, values)
          if (res.error) {
            toast.error(res.error)
            setCoupons(original)
          } else {
            toast.success('تم تحديث الكوبون بنجاح')
            router.refresh()
          }
        } else {
          setFormOpen(false)
          const res = await createCoupon(values)
          if (res.error) {
            toast.error(res.error)
          } else {
            toast.success('تم إنشاء الكوبون بنجاح')
            router.refresh()
          }
        }
      },
      deleting,
      closeDelete: () => setDeleting(null),
      confirmDelete: async () => {
        if (deleting) {
          const original = [...coupons]
          setCoupons((prev) => prev.filter((c) => c.id !== deleting.id))
          const id = deleting.id
          setDeleting(null)
          
          const res = await deleteCoupon(id)
          if (res.error) {
            toast.error(res.error)
            setCoupons(original)
          } else {
            toast.success('تم حذف الكوبون')
            router.refresh()
          }
        } else {
          setDeleting(null)
        }
      },
    }),
    [coupons, lectures, formOpen, editing, deleting],
  )

  return <CouponsContext.Provider value={value}>{children}</CouponsContext.Provider>
}
