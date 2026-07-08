'use client'

import { useState, useTransition } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronLeft, Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react'
import type { ActivityLog, ActivityFilters, ActorOption } from '@/app/admin/activity/actions'
import { getActivityLogs } from '@/app/admin/activity/actions'
import { ActivityFiltersBar } from './activity-filters-bar'
import { Pagination } from '@/components/ui/pagination'

// ── helpers ──────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  create:  { label: 'إضافة',   icon: Plus,         color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  update:  { label: 'تعديل',   icon: Pencil,        color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-500/10' },
  delete:  { label: 'حذف',     icon: Trash2,        color: 'text-destructive', bg: 'bg-destructive/10' },
  approve: { label: 'قبول',    icon: CheckCircle,   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  reject:  { label: 'رفض',     icon: XCircle,       color: 'text-destructive', bg: 'bg-destructive/10' },
}

const RESOURCE_LABELS: Record<string, string> = {
  students:      'الطلاب',
  courses:       'المحاضرات',
  categories:    'التصنيفات',
  exams:         'الاختبارات',
  calendar:      'التقويم',
  payments:      'الطلبات',
  messages:      'الرسائل',
  notifications: 'الإشعارات',
  coupons:       'الكوبونات',
  reports:       'التقارير',
  settings:      'الإعدادات',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} ساعة`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `منذ ${days} يوم`
  return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── component ─────────────────────────────────────────────────────────────────

export function ActivityLogTable({
  initialLogs,
  initialTotal,
  actors,
}: {
  initialLogs: ActivityLog[]
  initialTotal: number
  actors: ActorOption[]
}) {
  const [logs, setLogs] = useState(initialLogs)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Omit<ActivityFilters, 'page'>>({})
  const [isPending, startTransition] = useTransition()

  const PAGE_SIZE = 10
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function load(newFilters: Omit<ActivityFilters, 'page'>, newPage: number) {
    startTransition(async () => {
      const res = await getActivityLogs({ ...newFilters, page: newPage })
      setLogs(res.logs)
      setTotal(res.total)
      setPage(newPage)
    })
  }

  function handleFiltersChange(f: Omit<ActivityFilters, 'page'>) {
    setFilters(f)
    load(f, 1)
  }

  return (
    <div className="space-y-4">
      <ActivityFiltersBar actors={actors} onChange={handleFiltersChange} mode="activity" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-right">
                <th className="px-4 py-3 font-semibold text-muted-foreground">الفعل</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">المورد</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">التفاصيل</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">بواسطة</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">الوقت</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y divide-border', isPending && 'opacity-50')}>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    لا توجد سجلات
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const meta = ACTION_META[log.action] ?? ACTION_META.update
                  const Icon = meta.icon
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <span className={cn('flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold', meta.bg, meta.color)}>
                          <Icon className="size-3.5" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {RESOURCE_LABELS[log.resource] ?? log.resource}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <span className="line-clamp-1 text-foreground">{log.target_label ?? '—'}</span>
                        {log.target_id && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{log.target_id}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground">{log.actor_name}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'w-fit text-xs',
                              log.actor_role === 'admin'
                                ? 'border-primary/30 text-primary'
                                : 'border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400',
                            )}
                          >
                            {log.actor_role === 'admin' ? 'أدمن' : 'مساعد'}
                          </Badge>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {relativeTime(log.created_at)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col gap-2 p-2">
            <div className="px-4 py-2 text-sm text-muted-foreground text-center sm:text-right">
              إجمالي السجلات: {total.toLocaleString('ar-EG')}
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => load(filters, p)}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
