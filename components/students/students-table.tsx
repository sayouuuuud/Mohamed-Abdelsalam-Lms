'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Trash2, Mail, Phone } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/get-initials'
import { cn } from '@/lib/utils'
import {
  getStudentAvatar,
  statusFilters,
  type StudentStatus,
} from '@/lib/students-data'
import { useStudents } from './students-context'
import { Pagination } from '@/components/ui/pagination'

const ITEMS_PER_PAGE = 10

const statusStyles: Record<StudentStatus, string> = {
  نشط: 'bg-success/10 text-success',
  موقوف: 'bg-destructive/10 text-destructive',
}

export function StudentsTable() {
  const { students, requestDelete } = useStudents()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [filter, setFilter] = useState<StudentStatus | 'الكل'>('الكل')
  const [page, setPage] = useState(1)

  // Sync with URL param (e.g. when navigated from admin header search).
  useEffect(() => {
    setQuery(searchParams.get('q') || '')
  }, [searchParams])

  useEffect(() => {
    setPage(1)
  }, [query, filter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students.filter((student) => {
      const matchesStatus = filter === 'الكل' || student.status === filter
      const matchesQuery =
        q === '' ||
        student.name.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q) ||
        student.id.toLowerCase().includes(q) ||
        (student.phone ?? '').toLowerCase().includes(q)
      return matchesStatus && matchesQuery
    })
  }, [query, filter, students])

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
            placeholder="ابحث بالاسم أو البريد أو الرقم أو الهاتف..."
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
              <th className="px-3 py-3 font-medium">الطالب</th>
              <th className="px-3 py-3 font-medium">رقم الطالب</th>
              <th className="px-3 py-3 font-medium">المحاضرات</th>
              <th className="px-3 py-3 font-medium">نسبة التقدم</th>
              <th className="px-3 py-3 font-medium">إجمالي الإنفاق</th>
              <th className="px-3 py-3 font-medium">الحالة</th>
              <th className="px-3 py-3 font-medium">تاريخ الانضمام</th>
              <th className="px-3 py-3 font-medium sr-only">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((student) => (
              <tr
                key={student.id}
                onClick={() => router.push(`/admin/students/${student.id}`)}
                className="cursor-pointer transition-colors hover:bg-secondary/40"
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarImage
                        src={getStudentAvatar(student)}
                        alt={student.name}
                      />
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(student.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{student.name}</p>
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">
                        {student.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                  {student.id}
                </td>
                <td className="px-3 py-3 text-foreground">{student.courses}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${student.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {student.progress}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 font-semibold text-foreground">
                  {student.spent}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      statusStyles[student.status],
                    )}
                  >
                    {student.status}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                  {student.joinedAt}
                </td>
                <td className="px-3 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      requestDelete(student)
                    }}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">حذف الطالب</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="mt-5 space-y-3 md:hidden">
        {paginated.map((student) => (
          <li
            key={student.id}
            className="rounded-xl border border-border bg-secondary/30 p-4"
          >
            <div
              className="flex cursor-pointer items-center gap-3"
              onClick={() => router.push(`/admin/students/${student.id}`)}
            >
              <Avatar className="size-10">
                <AvatarImage src={getStudentAvatar(student)} alt={student.name} />
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(student.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{student.name}</p>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">
                  {student.email}
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  statusStyles[student.status],
                )}
              >
                {student.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>المحاضرات: <strong className="text-foreground">{student.courses}</strong></span>
              <span>الإنفاق: <strong className="text-foreground">{student.spent}</strong></span>
              <span>التقدم: <strong className="text-foreground">{student.progress}%</strong></span>
              <span>انضم: <strong className="text-foreground">{student.joinedAt}</strong></span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-border bg-card"
                onClick={() => router.push('/admin/messages')}
              >
                <Mail className="size-3.5" />
                مراسلة
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-border bg-card"
                onClick={() => {
                  window.location.href = `tel:${student.phone.replace(/\s/g, '')}`
                }}
              >
                <Phone className="size-3.5" />
                اتصال
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          لا يوجد طلاب مطابقون لبحثك
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
