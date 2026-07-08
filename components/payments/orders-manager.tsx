'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  Inbox,
  Eye,
  Check,
  X,
  Mail,
  Phone,
  Hash,
  CalendarDays,
  CreditCard,
  Layers,
  MessageSquare,
  Loader2,
  StickyNote,
  ReceiptText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/get-initials'
import {
  updateOrderStatus,
  messageStudent,
  type AdminOrder,
  type OrderStatus,
} from '@/app/admin/payments/orders-actions'
import { Pagination } from '@/components/ui/pagination'

const ITEMS_PER_PAGE = 10

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
}

const statusStyles: Record<OrderStatus, string> = {
  pending:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  approved:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  rejected:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
}

const FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: 'قيد المراجعة' },
  { value: 'approved', label: 'مقبول' },
  { value: 'rejected', label: 'مرفوض' },
]

function formatEGP(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value)
}

function DetailRow({
  icon: Icon,
  label,
  value,
  dir,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  dir?: 'ltr' | 'rtl'
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </span>
      <span
        dir={dir}
        className={cn('truncate text-left font-medium text-foreground', mono && 'font-mono')}
      >
        {value || '—'}
      </span>
    </div>
  )
}

export function OrdersManager({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const router = useRouter()
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [preview, setPreview] = useState<AdminOrder | null>(null)
  const [messaging, setMessaging] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [query, status])

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'pending').length
    const approved = orders.filter((o) => o.status === 'approved').length
    const rejected = orders.filter((o) => o.status === 'rejected').length
    const revenue = orders
      .filter((o) => o.status === 'approved')
      .reduce((sum, o) => sum + o.total, 0)
    return { pending, approved, rejected, revenue }
  }, [orders])

  const statCards = [
    { label: 'طلبات قيد المراجعة', value: String(stats.pending), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'طلبات مقبولة', value: String(stats.approved), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'طلبات مرفوضة', value: String(stats.rejected), icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10' },
    { label: 'إجمالي الإيرادات', value: `${formatEGP(stats.revenue)} ج.م`, icon: Wallet, color: 'text-primary', bg: 'bg-primary/10' },
  ]

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = status === 'all' || o.status === status
      const q = query.trim()
      const matchesQuery =
        q === '' ||
        o.studentName.includes(q) ||
        o.code.includes(q) ||
        o.items.some((i) => i.title.includes(q))
      return matchesStatus && matchesQuery
    })
  }, [orders, query, status])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  }, [filtered, page])

  async function changeStatus(id: string, next: OrderStatus) {
    const original = [...orders]
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)))
    setPreview((p) => (p && p.id === id ? { ...p, status: next } : p))

    const res = await updateOrderStatus(id, next)
    if (res.error) {
      toast.error(res.error)
      setOrders(original)
      setPreview((p) => (p && p.id === id ? original.find((o) => o.id === id) || p : p))
    } else {
      toast.success(next === 'approved' ? 'تم قبول الطلب' : 'تم رفض الطلب')
      router.refresh()
    }
  }

  async function contactStudent(order: AdminOrder) {
    setMessaging(true)
    const res = await messageStudent(order.id)
    setMessaging(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('تم فتح محادثة مع الطالب')
    router.push('/admin/messages')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">طلبات الاشتراك</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="gap-0 p-5 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className={cn('flex size-10 items-center justify-center rounded-xl', stat.bg)}>
                <stat.icon className={cn('size-5', stat.color)} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatus(filter.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  status === filter.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم الطالب أو رقم الطلب..."
              className="w-full rounded-lg border border-border bg-background py-2 pr-9 pl-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-5 py-3 font-medium">الطالب</th>
                <th className="px-5 py-3 font-medium">رقم الطلب</th>
                <th className="px-5 py-3 font-medium">المحاضرات</th>
                <th className="px-5 py-3 font-medium">الإجمالي</th>
                <th className="px-5 py-3 font-medium">التاريخ</th>
                <th className="px-5 py-3 font-medium">الحالة</th>
                <th className="px-5 py-3 font-medium">الطلب</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {getInitials(o.studentName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{o.studentName}</p>
                        <p className="text-xs text-muted-foreground">{o.studentEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{o.code}</td>
                  <td className="px-5 py-4 text-foreground">{o.items.length} محاضرة</td>
                  <td className="px-5 py-4 font-semibold text-foreground">{formatEGP(o.total)} ج.م</td>
                  <td className="px-5 py-4 text-muted-foreground">{o.createdAt}</td>
                  <td className="px-5 py-4">
                    <Badge variant="outline" className={cn('font-medium', statusStyles[o.status])}>
                      {STATUS_LABEL[o.status]}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setPreview(o)}>
                      <Eye className="size-4" />
                      عرض الطلب
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-border lg:hidden">
          {paginated.map((o) => (
            <div key={o.id} className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {getInitials(o.studentName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{o.studentName}</p>
                    <p className="text-xs text-muted-foreground">{o.createdAt}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cn('font-medium', statusStyles[o.status])}>
                  {STATUS_LABEL[o.status]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">رقم الطلب</p>
                  <p className="font-mono text-xs text-foreground">{o.code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المحاضرات</p>
                  <p className="text-foreground">{o.items.length} محاضرة</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الإجمالي</p>
                  <p className="font-semibold text-foreground">{formatEGP(o.total)} ج.م</p>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setPreview(o)}>
                <Eye className="size-4" />
                عرض الطلب
              </Button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">لا توجد طلبات مطابقة</p>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </Card>

      {/* Order detail modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="تفاصيل الطلب"
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {getInitials(preview.studentName)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-right">
                  <h3 className="text-base font-bold text-foreground">{preview.studentName}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{preview.code}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setPreview(null)}>
                <X className="size-4" />
                <span className="sr-only">إغلاق</span>
              </Button>
            </div>

            {/* بيانات الطالب */}
            <div className="mt-4 space-y-1">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">بيانات الطالب</p>
              <DetailRow icon={Mail} label="البريد الإلكتروني" value={preview.studentEmail} dir="ltr" />
              <DetailRow icon={Phone} label="رقم الهاتف" value={preview.studentPhone} dir="ltr" />
            </div>

            {/* المحاضرات المطلوبة */}
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Layers className="size-3.5" />
                المحاضرات المطلوبة ({preview.items.length})
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {preview.items.map((item, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.stageTitle} · {item.branchTitle}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-primary">
                      {formatEGP(item.price)} ج.م
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* تفاصيل الدفع */}
            <div className="mt-4 space-y-1 rounded-xl bg-secondary/50 p-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">تفاصيل الدفع</p>
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="size-4" />
                  الإجمالي
                </span>
                <span className="text-base font-bold text-foreground">
                  {formatEGP(preview.total)} ج.م
                </span>
              </div>
              <DetailRow icon={CreditCard} label="وسيلة الدفع" value={preview.method} />
              <DetailRow icon={Hash} label="رقم العملية" value={preview.reference} dir="ltr" mono />
              <DetailRow icon={CalendarDays} label="تاريخ الطلب" value={preview.createdAt} />
            </div>

            {/* صورة إيصال التحويل */}
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <ReceiptText className="size-3.5" />
                إيصال التحويل
              </p>
              {preview.receiptUrl ? (
                <a
                  href={preview.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-border transition-opacity hover:opacity-90"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.receiptUrl || '/placeholder.svg'}
                    alt={`إيصال تحويل الطلب ${preview.code}`}
                    className="max-h-72 w-full bg-secondary/40 object-contain"
                  />
                </a>
              ) : (
                <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">
                  لم يرفع الطالب صورة للتحويل
                </p>
              )}
            </div>

            {/* ملاحظة الطالب */}
            {preview.note && (
              <div className="mt-4 rounded-xl border border-border p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <StickyNote className="size-3.5" />
                  ملاحظة الطالب
                </p>
                <p className="text-sm leading-relaxed text-foreground">{preview.note}</p>
              </div>
            )}

            {/* contact */}
            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={messaging}
              onClick={() => contactStudent(preview)}
            >
              {messaging ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
              مراسلة الطالب
            </Button>

            {/* decision */}
            {preview.status === 'pending' ? (
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => changeStatus(preview.id, 'approved')}
                >
                  <Check className="size-4" />
                  قبول الطلب
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
                  onClick={() => changeStatus(preview.id, 'rejected')}
                >
                  <X className="size-4" />
                  رفض الطلب
                </Button>
              </div>
            ) : (
              <div className="mt-3">
                <Badge
                  variant="outline"
                  className={cn('w-full justify-center py-2', statusStyles[preview.status])}
                >
                  {STATUS_LABEL[preview.status]}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
