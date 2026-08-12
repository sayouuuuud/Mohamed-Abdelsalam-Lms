'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, BookOpen, Send, Hourglass } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Pagination } from '@/components/ui/pagination'
import type { AssignmentOverview } from '@/app/admin/assignments/actions'

const ITEMS_PER_PAGE = 10

type TypeFilter = 'الكل' | 'تسليم' | 'اختبار'

const typeFilters: { value: TypeFilter; label: string }[] = [
  { value: 'الكل', label: 'الكل' },
  { value: 'تسليم', label: 'تسليم' },
  { value: 'اختبار', label: 'اختبار' },
]

function scoreColor(score: number) {
  if (score === 0) return 'text-muted-foreground'
  if (score >= 75) return 'text-emerald-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-rose-600'
}

export function AssignmentsTable({ assignments }: { assignments: AssignmentOverview[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TypeFilter>('الكل')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [query, filter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assignments.filter((a) => {
      const matchesType = filter === 'الكل' || a.type === filter
      const matchesQuery =
        q === '' ||
        a.title.toLowerCase().includes(q) ||
        a.courseTitle.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q)
      return matchesType && matchesQuery
    })
  }, [query, filter, assignments])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  }, [filtered, page])

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
            placeholder="ابحث بالعنوان أو المحاضرة أو الرقم..."
            className="h-11 w-full rounded-xl border border-border bg-secondary/60 pr-10 pl-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {typeFilters.map((item) => (
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
              <th className="px-3 py-3 font-medium">الواجب</th>
              <th className="px-3 py-3 font-medium">النوع</th>
              <th className="px-3 py-3 font-medium">التسليمات</th>
              <th className="px-3 py-3 font-medium">بانتظار التصحيح</th>
              <th className="px-3 py-3 font-medium">متوسط الدرجات</th>
              <th className="px-3 py-3 font-medium">تاريخ التسليم النهائي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((a) => (
              <tr
                key={a.id}
                onClick={() => router.push(`/admin/assignments/${a.code}`)}
                className="cursor-pointer transition-colors hover:bg-secondary/40"
              >
                <td className="px-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.courseTitle}</p>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Badge variant="secondary" className="shadow-none">
                    {a.type}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-foreground">{a.submittedCount.toLocaleString('ar-EG')}</td>
                <td className="px-3 py-3">
                  {a.pendingCount > 0 ? (
                    <Badge variant="secondary" className="gap-1 shadow-none">
                      <Hourglass className="size-3" />
                      {a.pendingCount.toLocaleString('ar-EG')}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {a.avgScore === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <span className={cn('font-semibold', scoreColor(a.avgScore))}>{a.avgScore}</span>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                  {a.dueDate ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="mt-5 space-y-3 md:hidden">
        {paginated.map((a) => (
          <li
            key={a.id}
            onClick={() => router.push(`/admin/assignments/${a.code}`)}
            className="cursor-pointer rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">{a.courseTitle}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 shadow-none">
                {a.type}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Send className="size-3.5" />
                {a.submittedCount.toLocaleString('ar-EG')} تسليم
              </span>
              <span className="flex items-center gap-1.5">
                <Hourglass className="size-3.5" />
                {a.pendingCount.toLocaleString('ar-EG')} بانتظار التصحيح
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" />
                {a.dueDate ?? '—'}
              </span>
              <span>
                المتوسط:{' '}
                {a.avgScore === 0 ? (
                  <strong className="text-foreground">—</strong>
                ) : (
                  <strong className={scoreColor(a.avgScore)}>{a.avgScore}</strong>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          لا توجد واجبات مطابقة لبحثك
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </Card>
  )
}
