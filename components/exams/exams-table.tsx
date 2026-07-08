'use client'

import { useMemo, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Search, Clock, ListChecks, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { examStatusFilters, type ExamStatus, type ExamRecord } from '@/lib/exams-data'
import { Pagination } from '@/components/ui/pagination'

const ITEMS_PER_PAGE = 10

const statusStyles: Record<ExamStatus, string> = {
  منشور: 'bg-success/10 text-success',
  مسودة: 'bg-secondary text-muted-foreground',
  منتهي: 'bg-destructive/10 text-destructive',
}

function scoreColor(score: number) {
  if (score === 0) return 'text-muted-foreground'
  if (score >= 75) return 'text-emerald-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-rose-600'
}

export function ExamsTable({ initialExams }: { initialExams: ExamRecord[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ExamStatus | 'الكل'>('الكل')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [query, filter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialExams.filter((exam) => {
      const matchesStatus = filter === 'الكل' || exam.status === filter
      const matchesQuery =
        q === '' ||
        exam.title.toLowerCase().includes(q) ||
        exam.course.toLowerCase().includes(q) ||
        exam.id.toLowerCase().includes(q)
      return matchesStatus && matchesQuery
    })
  }, [query, filter])

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
            placeholder="ابحث بالعنوان أو الكورس أو الرقم..."
            className="h-11 w-full rounded-xl border border-border bg-secondary/60 pr-10 pl-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {examStatusFilters.map((item) => (
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
              <th className="px-3 py-3 font-medium">الاختبار</th>
              <th className="px-3 py-3 font-medium">الأسئلة</th>
              <th className="px-3 py-3 font-medium">المدة</th>
              <th className="px-3 py-3 font-medium">المشاركون</th>
              <th className="px-3 py-3 font-medium">متوسط الدرجات</th>
              <th className="px-3 py-3 font-medium">الحالة</th>
              <th className="px-3 py-3 font-medium">تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((exam) => (
              <tr 
                key={exam.id} 
                onClick={() => router.push(`/admin/exams/${exam.id}`)}
                className="cursor-pointer transition-colors hover:bg-secondary/40"
              >
                <td className="px-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{exam.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{exam.course}</p>
                  </div>
                </td>
                <td className="px-3 py-3 text-foreground">{exam.questions} سؤال</td>
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                  {exam.duration} دقيقة
                </td>
                <td className="px-3 py-3 text-foreground">
                  {exam.participants.toLocaleString('ar-EG')}
                </td>
                <td className="px-3 py-3">
                  {exam.avgScore === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <span className={cn('font-semibold', scoreColor(exam.avgScore))}>
                      {exam.avgScore}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      statusStyles[exam.status],
                    )}
                  >
                    {exam.status}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                  {exam.createdAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="mt-5 space-y-3 md:hidden">
        {paginated.map((exam) => (
          <li
            key={exam.id}
            onClick={() => router.push(`/admin/exams/${exam.id}`)}
            className="cursor-pointer rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{exam.title}</p>
                <p className="truncate text-xs text-muted-foreground">{exam.course}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  statusStyles[exam.status],
                )}
              >
                {exam.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ListChecks className="size-3.5" />
                {exam.questions} سؤال
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {exam.duration} دقيقة
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                {exam.participants.toLocaleString('ar-EG')} مشارك
              </span>
              <span>
                المتوسط:{' '}
                {exam.avgScore === 0 ? (
                  <strong className="text-foreground">—</strong>
                ) : (
                  <strong className={scoreColor(exam.avgScore)}>{exam.avgScore}%</strong>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          لا توجد اختبارات مطابقة لبحثك
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
