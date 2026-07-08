'use client'

import { useMemo, useState, useEffect } from 'react'
import { Search, Copy, Check, Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type CouponStatus } from '@/lib/coupons-data'
import { useCoupons } from './coupons-context'
import { Pagination } from '@/components/ui/pagination'

const ITEMS_PER_PAGE = 10

const statusStyles: Record<CouponStatus, string> = {
  نشط: 'bg-success/10 text-success',
  منتهي: 'bg-secondary text-muted-foreground',
  متوقف: 'bg-destructive/10 text-destructive',
}

const statusFilters: { label: string; value: CouponStatus | 'الكل' }[] = [
  { label: 'الكل', value: 'الكل' },
  { label: 'نشط', value: 'نشط' },
  { label: 'منتهي', value: 'منتهي' },
  { label: 'متوقف', value: 'متوقف' },
]

function formatDiscount(type: string, value: number) {
  return type === 'نسبة مئوية' ? `${value}%` : `${value} ج.م`
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB')
}

export function CouponsTable() {
  const { coupons, openEdit, requestDelete } = useCoupons()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CouponStatus | 'الكل'>('الكل')
  const [copied, setCopied] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [query, filter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return coupons.filter((coupon) => {
      const matchesStatus = filter === 'الكل' || coupon.status === filter
      const matchesQuery =
        q === '' ||
        coupon.code.toLowerCase().includes(q) ||
        coupon.description.toLowerCase().includes(q)
      return matchesStatus && matchesQuery
    })
  }, [query, filter, coupons])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  }, [filtered, page])

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500)
  }

  return (
    <Card className="gap-0 p-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالكود أو الوصف..."
            className="h-11 w-full rounded-xl border border-border bg-secondary/60 pr-10 pl-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {statusFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                'rounded-lg border px-4 py-2 text-xs font-semibold transition-colors',
                filter === item.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="mt-5 hidden overflow-x-auto md:block">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-3 font-medium">الكود</th>
              <th className="px-3 py-3 font-medium">الوصف</th>
              <th className="px-3 py-3 font-medium">قيمة الخصم</th>
              <th className="px-3 py-3 font-medium">الاستخدام</th>
              <th className="px-3 py-3 font-medium">الصلاحية</th>
              <th className="px-3 py-3 font-medium">الحالة</th>
              <th className="px-3 py-3 font-medium sr-only">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((coupon) => {
              const pct = Math.min(100, Math.round((coupon.used / coupon.limit) * 100))
              return (
                <tr key={coupon.id} className="transition-colors hover:bg-secondary/40">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleCopy(coupon.code)}
                      className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 px-2.5 py-1 font-mono text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {coupon.code}
                      {copied === coupon.code ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5 opacity-60" />
                      )}
                    </button>
                  </td>
                  <td className="max-w-xs px-3 py-3 text-muted-foreground">
                    {coupon.description}
                  </td>
                  <td className="px-3 py-3 font-semibold text-foreground whitespace-nowrap">
                    {formatDiscount(coupon.type, coupon.value)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {coupon.used.toLocaleString('en-US')}/
                        {coupon.limit.toLocaleString('en-US')}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground" dir="ltr">
                    {formatDate(coupon.startDate)} - {formatDate(coupon.endDate)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        statusStyles[coupon.status],
                      )}
                    >
                      {coupon.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(coupon)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">تعديل الكوبون</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => requestDelete(coupon)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">حذف الكوبون</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="mt-5 space-y-3 md:hidden">
        {paginated.map((coupon) => {
          const pct = Math.min(100, Math.round((coupon.used / coupon.limit) * 100))
          return (
            <li
              key={coupon.id}
              className="rounded-xl border border-border bg-secondary/30 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(coupon.code)}
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-card px-2.5 py-1 font-mono text-xs font-bold text-foreground"
                >
                  {coupon.code}
                  {copied === coupon.code ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <Copy className="size-3.5 opacity-60" />
                  )}
                </button>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    statusStyles[coupon.status],
                  )}
                >
                  {coupon.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{coupon.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>
                  الخصم:{' '}
                  <strong className="text-foreground">
                    {formatDiscount(coupon.type, coupon.value)}
                  </strong>
                </span>
                <span>
                  الاستخدام:{' '}
                  <strong className="text-foreground">
                    {coupon.used}/{coupon.limit} ({pct}%)
                  </strong>
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-border bg-card"
                  onClick={() => openEdit(coupon)}
                >
                  <Pencil className="size-3.5" />
                  تعديل
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-border bg-card text-destructive hover:text-destructive"
                  onClick={() => requestDelete(coupon)}
                >
                  <Trash2 className="size-3.5" />
                  حذف
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          لا توجد كوبونات مطابقة لبحثك
        </div>
      )}

      {/* Footer */}
      {filtered.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </Card>
  )
}
