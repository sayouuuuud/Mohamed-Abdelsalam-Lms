'use client'

import Link from 'next/link'
import { ArrowRight, Loader2, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useCart } from '@/components/cart/cart-provider'
import { addTermToCart } from '@/app/cart-actions'

/**
 * Subscribe button — supports three modes:
 *  - termId provided   → subscribe to a whole term bundle
 *  - lectureIds array  → add individual lectures (legacy / fallback)
 */
export function SubscribeButton({
  termId,
  lectureIds = [],
  label,
  className,
}: {
  termId?: string
  lectureIds?: string[]
  label: string
  className?: string
}) {
  const { add, loggedIn, setOpen, items } = useCart()
  const [busy, setBusy] = useState(false)

  if (!loggedIn) {
    return (
      <Link href="/auth?mode=register" className={className}>
        {label}
        <ArrowRight className="size-5 rotate-180" />
      </Link>
    )
  }

  const handleClick = async () => {
    setBusy(true)

    if (termId) {
      // Term bundle — single server action call.
      const already = items.some((i) => i.termId === termId)
      if (already) {
        setOpen(true)
        toast.info('باقة الترم موجودة في السلة بالفعل')
        setBusy(false)
        return
      }
      const res = await addTermToCart(termId)
      setBusy(false)
      if ('error' in res) {
        toast.error('تعذّر إضافة الترم للسلة')
        return
      }
      setOpen(true)
      toast.success('تمت إضافة باقة الترم للسلة')
      return
    }

    // Fallback: add individual lectures.
    const inCartIds = new Set(items.map((i) => i.lectureId))
    const toAdd = lectureIds.filter((id) => id && !inCartIds.has(id))
    if (toAdd.length === 0 && lectureIds.length > 0) {
      setOpen(true)
      toast.info('كل المحاضرات موجودة في السلة بالفعل')
      setBusy(false)
      return
    }
    for (const id of toAdd) {
      await add(id)
    }
    setBusy(false)
    setOpen(true)
    toast.success('تمت إضافة المحاضرات للسلة')
  }

  return (
    <button type="button" onClick={handleClick} disabled={busy} className={className}>
      {busy ? <Loader2 className="size-5 animate-spin" /> : <ShoppingCart className="size-5" />}
      {label}
    </button>
  )
}
