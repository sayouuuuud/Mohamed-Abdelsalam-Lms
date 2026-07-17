'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ShoppingCart,
  X,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  CreditCard,
  Tag,
  Tags,
  UploadCloud,
  ReceiptText,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from './cart-provider'
import { createOrder, getCheckoutDefaults } from '@/app/cart-actions'
import { uploadFiles } from '@/lib/uploadthing'

function formatEGP(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value)
}

const PAYMENT_METHODS = [
  'فودافون كاش',
  'اتصالات كاش',
  'أورنج كاش',
  'إنستا باي',
  'تحويل بنكي',
]

type View = 'cart' | 'checkout' | 'done'

export function CartModal() {
  const {
    open,
    setOpen,
    items,
    total,
    count,
    remove,
    removeCourse,
    removeTerm,
    coupon,
    couponLoading,
    applyCoupon,
    clearCoupon,
    discount,
    grandTotal,
  } = useCart()
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<View>('cart')
  const [submitting, setSubmitting] = useState(false)
  const [orderCode, setOrderCode] = useState('')
  const [couponInput, setCouponInput] = useState('')

  // form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState(PAYMENT_METHODS[0])
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  async function handleReceiptFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('من فضلك ارفع صورة من إيصال التحويل')
      return
    }
    setUploadingReceipt(true)
    try {
      const res = await uploadFiles('receiptUploader', {
        files: [file],
      })
      if (!res || !res[0]) throw new Error('فشل الرفع')
      
      setReceiptUrl(res[0].url)
      toast.success('تم رفع صورة التحويل')
    } catch (e) {
      toast.error(`فشل الرفع: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`)
    } finally {
      setUploadingReceipt(false)
    }
  }

  useEffect(() => setMounted(true), [])

  // reset to cart view whenever the modal closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setView('cart'), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  // prefill checkout defaults when entering the form
  useEffect(() => {
    if (view === 'checkout') {
      getCheckoutDefaults().then((d) => {
        setName((v) => v || d.name)
        setPhone((v) => v || d.phone)
      })
    }
  }, [view])

  // lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  if (!mounted || !open) return null

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      toast.error('من فضلك اكتب الاسم ورقم الهاتف')
      return
    }
    if (!receiptUrl) {
      toast.error('من فضلك ارفع صورة من إيصال التحويل')
      return
    }
    setSubmitting(true)
    const res = await createOrder({
      name,
      phone,
      method,
      reference,
      note,
      receiptUrl,
      couponCode: coupon?.code,
    })
    setSubmitting(false)
    if (res?.error) {
      toast.error(typeof res.error === 'string' ? res.error : 'تعذّر إرسال الطلب')
      return
    }
    setOrderCode(res.code ?? '')
    setView('done')
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* overlay */}
      <button
        type="button"
        aria-label="إغلاق"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />

      {/* window */}
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
        {/* header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            {view === 'checkout' && (
              <button
                type="button"
                onClick={() => setView('cart')}
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                aria-label="رجوع للسلة"
              >
                <ArrowLeft className="size-4 -scale-x-100" />
              </button>
            )}
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              {view === 'done' ? (
                <CheckCircle2 className="size-5" />
              ) : view === 'checkout' ? (
                <CreditCard className="size-5" />
              ) : (
                <ShoppingCart className="size-5" />
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {view === 'cart' && `سلة الاشتراكات${count > 0 ? ` (${count})` : ''}`}
              {view === 'checkout' && 'إتمام الطلب'}
              {view === 'done' && 'تم استلام طلبك'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            aria-label="إغلاق"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ── Cart view ── */}
          {view === 'cart' &&
            (count === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
                  <ShoppingCart className="size-7" />
                </div>
                <p className="text-base font-semibold text-foreground">السلة فاضية</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  ضيف المحاضرات اللي عايز تشترك فيها من صفحات الفروع وهتلاقيها هنا.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.termId ?? item.monthlyCourseId ?? item.lectureId} className="flex items-start gap-3 px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.stageTitle}{item.branchTitle ? ` · ${item.branchTitle}` : ''}
                        {item.itemType === 'term_bundle' && (
                          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            باقة ترم
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm font-bold text-primary">
                        {formatEGP(item.price)} ج.م
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.termId) return removeTerm(item.termId)
                        if (item.monthlyCourseId) return removeCourse(item.monthlyCourseId)
                        if (item.lectureId) return remove(item.lectureId)
                      }}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`إزالة ${item.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {/* ── Checkout view ── */}
          {view === 'checkout' && (
            <form id="checkout-form" onSubmit={submitOrder} className="space-y-4 px-6 py-5">
              <div className="rounded-2xl bg-muted/50 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">عدد المحاضرات</span>
                  <span className="font-bold text-foreground">{count}</span>
                </div>
                {discount > 0 && (
                  <>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">المجموع</span>
                      <span className="text-muted-foreground">{formatEGP(total)} ج.م</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">
                        خصم{coupon ? ` (${coupon.code})` : ''}
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        - {formatEGP(discount)} ج.م
                      </span>
                    </div>
                  </>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">الإجمالي</span>
                  <span className="font-bold text-primary">{formatEGP(grandTotal)} ج.م</span>
                </div>
                {coupon && coupon.scope === 'lectures' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    الكوبون اتطبق على {coupon.coveredCount} من {coupon.itemsCount} محاضرة.
                  </p>
                )}
              </div>

              <Field label="الاسم بالكامل" required>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="اكتب اسمك"
                />
              </Field>

              <Field label="رقم الهاتف" required>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  className={inputCls}
                  placeholder="01xxxxxxxxx"
                />
              </Field>

              <Field label="وسيلة الدفع">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className={inputCls}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="رقم العملية / التحويل (اختياري)">
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={inputCls}
                  placeholder="رقم تحويل فودافون كاش مثلاً"
                />
              </Field>

              <Field label="صورة إيصال التحويل" required>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleReceiptFile(e.target.files?.[0])}
                />
                {receiptUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receiptUrl || '/placeholder.svg'}
                      alt="إيصال التحويل"
                      className="size-16 shrink-0 rounded-lg border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <ReceiptText className="size-4 text-primary" />
                        تم رفع صورة التحويل
                      </p>
                      <button
                        type="button"
                        onClick={() => receiptInputRef.current?.click()}
                        className="mt-0.5 text-xs font-medium text-primary hover:underline"
                      >
                        تغيير الصورة
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptUrl('')}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="إزالة الصورة"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingReceipt}
                    onClick={() => receiptInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-5 text-center transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {uploadingReceipt ? (
                      <>
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">جاري الرفع...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="size-6 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          ارفع صورة من تحويل المحفظة أو إنستا باي
                        </span>
                        <span className="text-xs text-muted-foreground">
                          JPG أو PNG (أقل من 8 MB)
                        </span>
                      </>
                    )}
                  </button>
                )}
              </Field>

              <Field label="ملاحظة للأدمن (اختياري)">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className={`${inputCls} h-auto min-h-[68px] resize-none py-2.5`}
                  placeholder="أي تفاصيل إضافية..."
                />
              </Field>
            </form>
          )}

          {/* ── Done view ── */}
          {view === 'done' && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-8" />
              </div>
              <p className="text-base font-bold text-foreground">تم إرسال طلبك للأدمن</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                رقم الطلب <span className="font-mono font-bold text-foreground">{orderCode}</span>.
                هيتم مراجعته والتواصل معاك قريبًا من خلال الرسائل.
              </p>
            </div>
          )}
        </div>

        {/* footer */}
        {view === 'cart' && count > 0 && (
          <div className="shrink-0 border-t border-border px-6 py-4">
            <CouponBox
              coupon={coupon}
              loading={couponLoading}
              value={couponInput}
              onChange={setCouponInput}
              onApply={() => applyCoupon(couponInput)}
              onClear={() => {
                clearCoupon()
                setCouponInput('')
              }}
            />

            <div className="mb-3 mt-3 space-y-1.5">
              {discount > 0 && (
                <>
                  <Row label="المجموع" value={`${formatEGP(total)} ج.م`} muted />
                  <Row
                    label={`خصم${coupon ? ` (${coupon.code})` : ''}`}
                    value={`- ${formatEGP(discount)} ج.م`}
                    discount
                  />
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الإجمالي</span>
                <span className="text-xl font-extrabold text-foreground">
                  {formatEGP(grandTotal)}{' '}
                  <span className="text-sm font-bold text-primary">ج.م</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setView('checkout')}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <CreditCard className="size-4" />
              إتمام الدفع
            </button>
          </div>
        )}

        {view === 'checkout' && (
          <div className="shrink-0 border-t border-border px-6 py-4">
            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جارٍ الإرسال...
                </>
              ) : (
                <>إرسال الطلب ({formatEGP(grandTotal)} ج.م)</>
              )}
            </button>
          </div>
        )}

        {view === 'done' && (
          <div className="shrink-0 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              تمام
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Row({
  label,
  value,
  muted,
  discount,
}: {
  label: string
  value: string
  muted?: boolean
  discount?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          discount
            ? 'font-semibold text-emerald-600 dark:text-emerald-400'
            : muted
              ? 'text-muted-foreground'
              : 'font-bold text-foreground'
        }
      >
        {value}
      </span>
    </div>
  )
}

function CouponBox({
  coupon,
  loading,
  value,
  onChange,
  onApply,
  onClear,
}: {
  coupon: { code: string } | null
  loading: boolean
  value: string
  onChange: (v: string) => void
  onApply: () => void
  onClear: () => void
}) {
  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          <Tags className="size-4" />
          كوبون <span className="font-mono">{coupon.code}</span> مفعّل
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-muted-foreground hover:text-destructive"
        >
          إزالة
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Tag className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (value.trim()) onApply()
            }
          }}
          placeholder="كود الخصم"
          className="h-11 w-full rounded-xl border border-border bg-secondary/50 pr-9 pl-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
        />
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={loading || !value.trim()}
        className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : 'تطبيق'}
      </button>
    </div>
  )
}

const inputCls =
  'h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  )
}
