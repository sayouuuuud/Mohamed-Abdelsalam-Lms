'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  getCartItems,
  addToCart as addToCartAction,
  removeFromCart as removeFromCartAction,
  addCourseToCart,
  removeCourseFromCart,
  removeTermFromCart,
  type CartItem,
} from '@/app/cart-actions'
import { applyCoupon as applyCouponAction, type AppliedCoupon } from '@/app/coupon-actions'

type CartContextValue = {
  items: CartItem[]
  count: number
  total: number // subtotal before discount
  loggedIn: boolean
  open: boolean
  setOpen: (open: boolean) => void
  inCart: (lectureId: string) => boolean
  courseInCart: (courseId: string) => boolean
  termInCart: (termId: string) => boolean
  add: (lectureId: string, title?: string) => Promise<void>
  addCourse: (courseId: string, title?: string) => Promise<void>
  remove: (lectureId: string) => Promise<void>
  removeCourse: (courseId: string) => Promise<void>
  removeTerm: (termId: string) => Promise<void>
  refresh: () => Promise<void>
  // coupon
  coupon: AppliedCoupon | null
  couponLoading: boolean
  applyCoupon: (code: string) => Promise<void>
  clearCoupon: () => void
  discount: number
  grandTotal: number // total after discount
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [items, setItems] = useState<CartItem[]>([])
  const [loggedIn, setLoggedIn] = useState(false)
  const [open, setOpen] = useState(false)
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)

  const refresh = useCallback(async () => {
    const data = await getCartItems()
    if (data === null) {
      setLoggedIn(false)
      setItems([])
    } else {
      setLoggedIn(true)
      setItems(data)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const inCart = useCallback(
    (lectureId: string) => items.some((i) => i.lectureId === lectureId),
    [items],
  )

  const courseInCart = useCallback(
    (courseId: string) => items.some((item) => item.monthlyCourseId === courseId),
    [items],
  )

  const termInCart = useCallback(
    (termId: string) => items.some((item) => item.termId === termId),
    [items],
  )

  const removeTerm = useCallback(async (termId: string) => {
    setItems((prev) => prev.filter((i) => i.termId !== termId))
    const res = await removeTermFromCart(termId)
    if (res?.error) {
      toast.error(res.error)
      await refresh()
    }
  }, [refresh])

  const addCourse = useCallback(async (courseId: string, title?: string) => {
    const res = await addCourseToCart(courseId)
    if (res?.error === 'unauthenticated') {
      toast.error('سجّل دخولك الأول عشان تضيف للسلة')
      router.push('/auth?mode=register')
      return
    }
    if (res?.error) return void toast.error(res.error)
    if (res?.enrolledFree) {
      toast.success(
        title
          ? `تم الاشتراك مجاناً في باقة "${title}" بنجاح! وتقدر تبدأ تذاكرها دلوقتي.`
          : 'تم الاشتراك مجاناً في الباقة بنجاح! وتقدر تبدأ تذاكرها دلوقتي.',
      )
      router.push('/student')
      return
    }
    await refresh()
    toast.success(title ? `تمت إضافة باقة "${title}" للسلة` : 'تمت إضافة باقة الكورس للسلة')
  }, [refresh, router])

  const removeCourse = useCallback(async (courseId: string) => {
    setItems((previous) => previous.filter((item) => item.monthlyCourseId !== courseId))
    const res = await removeCourseFromCart(courseId)
    if (res?.error) {
      toast.error(res.error)
      await refresh()
    }
  }, [refresh])

  const add = useCallback(
    async (lectureId: string, title?: string) => {
      const res = await addToCartAction(lectureId)
      if (res?.error === 'unauthenticated') {
        toast.error('سجّل دخولك الأول عشان تضيف للسلة')
        router.push('/auth?mode=register')
        return
      }
      if (res?.error) {
        toast.error(res.error)
        return
      }
      if (res?.enrolledFree) {
        toast.success('تم الاشتراك مجاناً في المحاضرة بنجاح! وتقدر تبدأ تذاكرها دلوقتي.')
        router.push('/student')
        return
      }

      await refresh()
      toast.success(title ? `تمت إضافة "${title}" للسلة` : 'تمت الإضافة للسلة')
    },
    [refresh, router],
  )

  const remove = useCallback(
    async (lectureId: string) => {
      // optimistic
      setItems((prev) => prev.filter((i) => i.lectureId !== lectureId))
      const res = await removeFromCartAction(lectureId)
      if (res?.error) {
        toast.error(res.error)
        await refresh()
      }
    },
    [refresh],
  )

  const applyCoupon = useCallback(async (code: string) => {
    setCouponLoading(true)
    const res = await applyCouponAction(code)
    setCouponLoading(false)
    if ('error' in res) {
      setCoupon(null)
      toast.error(res.error)
      return
    }
    setCoupon(res.applied)
    toast.success('تم تطبيق الكوبون')
  }, [])

  const clearCoupon = useCallback(() => setCoupon(null), [])

  const total = items.reduce((sum, i) => sum + i.price, 0)

  // Re-validate the coupon whenever cart contents change (e.g. an item was
  // removed). If it no longer applies, drop it silently.
  useEffect(() => {
    if (!coupon) return
    let cancelled = false
    applyCouponAction(coupon.code).then((res) => {
      if (cancelled) return
      if ('error' in res) setCoupon(null)
      else setCoupon(res.applied)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, items.length])

  const discount = coupon?.discount ?? 0
  const grandTotal = Math.max(0, total - discount)

  return (
    <CartContext.Provider
      value={{
        items,
        count: items.length,
        total,
        loggedIn,
        open,
        setOpen,
        inCart,
        courseInCart,
        termInCart,
        add,
        addCourse,
        remove,
        removeCourse,
        removeTerm,
        refresh,
        coupon,
        couponLoading,
        applyCoupon,
        clearCoupon,
        discount,
        grandTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
