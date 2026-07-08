'use client'

import { useState, useTransition } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronLeft, LogIn, LogOut } from 'lucide-react'
import type { AuthLog, AuthFilters, ActorOption } from '@/app/admin/activity/actions'
import { getAuthLogs } from '@/app/admin/activity/actions'
import { ActivityFiltersBar } from './activity-filters-bar'
import { Pagination } from '@/components/ui/pagination'

// ── helpers ──────────────────────────────────────────────────────────────────

function parseAgent(ua: string | null): string {
  if (!ua) return '—'
  // OS detection
  let os = 'غير معروف'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Linux')) os = 'Linux'
  // Browser detection
  let browser = ''
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Edg')) browser = 'Edge'
  return browser ? `${os} — ${browser}` : os
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

export function AuthLogTable({
  initialLogs,
  initialTotal,
  actors,
}: {
  initialLogs: AuthLog[]
  initialTotal: number
  actors: ActorOption[]
}) {
  const [logs, setLogs] = useState(initialLogs)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Omit<AuthFilters, 'page'>>({})
  const [isPending, startTransition] = useTransition()

  const PAGE_SIZE = 10
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function load(newFilters: Omit<AuthFilters, 'page'>, newPage: number) {
    startTransition(async () => {
      const res = await getAuthLogs({ ...newFilters, page: newPage })
      setLogs(res.logs)
      setTotal(res.total)
      setPage(newPage)
    })
  }

  function handleFiltersChange(f: Omit<AuthFilters, 'page'>) {
    setFilters(f)
    load(f, 1)
  }

  return (
    <div className="space-y-4">
      <ActivityFiltersBar actors={actors} onChange={handleFiltersChange} mode="auth" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-right">
                <th className="px-4 py-3 font-semibold text-muted-foreground">الحدث</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">المستخدم</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">عنوان IP</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">الجهاز</th>
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
                  const isLogin = log.event === 'login'
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold',
                            isLogin
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                              : 'bg-secondary text-muted-foreground',
                          )}
                        >
                          {isLogin ? <LogIn className="size-3.5" /> : <LogOut className="size-3.5" />}
                          {isLogin ? 'دخول' : 'خروج'}
                        </span>
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
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {log.ip ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {parseAgent(log.user_agent)}
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
