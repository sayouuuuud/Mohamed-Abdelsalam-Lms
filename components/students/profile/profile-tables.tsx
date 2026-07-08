'use client'

import { useState } from 'react'
import { BookOpen, CreditCard, ClipboardList, FileCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Pagination } from '@/components/ui/pagination'
import type { StudentProfile } from '@/lib/student-profile-data'

const ITEMS_PER_PAGE = 10

type TabKey = 'courses' | 'payments' | 'exams' | 'assignments'

const tabs: Array<{ key: TabKey; label: string; icon: typeof BookOpen }> = [
  { key: 'courses', label: 'الدورات', icon: BookOpen },
  { key: 'payments', label: 'المدفوعات', icon: CreditCard },
  { key: 'exams', label: 'الامتحانات والدرجات', icon: ClipboardList },
  { key: 'assignments', label: 'الواجبات', icon: FileCheck },
]

function Pill({ tone, children }: { tone: 'success' | 'danger' | 'muted' | 'warning'; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    success: 'bg-success/10 text-success',
    danger: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/15 text-warning-foreground dark:text-warning',
    muted: 'bg-secondary text-muted-foreground',
  }
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', styles[tone])}>
      {children}
    </span>
  )
}

export function ProfileTables({ profile }: { profile: StudentProfile }) {
  const [tab, setTab] = useState<TabKey>('courses')

  return (
    <Card className="gap-0 p-5">
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary',
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto">
        {tab === 'courses' && <CoursesView profile={profile} />}
        {tab === 'payments' && <PaymentsView profile={profile} />}
        {tab === 'exams' && <ExamsView profile={profile} />}
        {tab === 'assignments' && <AssignmentsView profile={profile} />}
      </div>
    </Card>
  )
}

function EmptyRow({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
}

function CoursesView({ profile }: { profile: StudentProfile }) {
  const [page, setPage] = useState(1)
  if (profile.courses.length === 0) return <EmptyRow text="لا توجد دورات مسجّلة" />

  const totalPages = Math.ceil(profile.courses.length / ITEMS_PER_PAGE)
  const paginated = profile.courses.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div className="space-y-4">
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-3 py-3 font-medium">الدورة</th>
            <th className="px-3 py-3 font-medium">التصنيف</th>
            <th className="px-3 py-3 font-medium">التقدم</th>
            <th className="px-3 py-3 font-medium">الدروس</th>
            <th className="px-3 py-3 font-medium">آخر نشاط</th>
            <th className="px-3 py-3 font-medium">الحالة</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paginated.map((c) => (
            <tr key={c.id} className="transition-colors hover:bg-secondary/40">
              <td className="px-3 py-3 font-semibold text-foreground">{c.name}</td>
              <td className="px-3 py-3 text-muted-foreground">{c.category}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${c.progress}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{c.progress}%</span>
                </div>
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {c.lessonsDone}/{c.lessonsTotal}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{c.lastAccessed}</td>
              <td className="px-3 py-3">
                <Pill tone={c.status === 'مكتمل' ? 'success' : c.status === 'متوقف' ? 'muted' : 'warning'}>
                  {c.status}
                </Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

function PaymentsView({ profile }: { profile: StudentProfile }) {
  const [page, setPage] = useState(1)
  if (profile.payments.length === 0) return <EmptyRow text="لا توجد مدفوعات" />

  const totalPages = Math.ceil(profile.payments.length / ITEMS_PER_PAGE)
  const paginated = profile.payments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div className="space-y-4">
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-3 py-3 font-medium">رقم العملية</th>
            <th className="px-3 py-3 font-medium">التاريخ</th>
            <th className="px-3 py-3 font-medium">البند</th>
            <th className="px-3 py-3 font-medium">المبلغ</th>
            <th className="px-3 py-3 font-medium">الوسيلة</th>
            <th className="px-3 py-3 font-medium">الحالة</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paginated.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-secondary/40">
              <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
              <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{p.date}</td>
              <td className="px-3 py-3 text-foreground">{p.item}</td>
              <td className="px-3 py-3 font-semibold text-foreground">{p.amount.toLocaleString()} ج.م</td>
              <td className="px-3 py-3 text-muted-foreground">{p.method}</td>
              <td className="px-3 py-3">
                <Pill tone={p.status === 'ناجح' ? 'success' : p.status === 'مسترد' ? 'danger' : 'warning'}>
                  {p.status}
                </Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

function ExamsView({ profile }: { profile: StudentProfile }) {
  const [page, setPage] = useState(1)
  if (profile.exams.length === 0) return <EmptyRow text="لا توجد امتحانات" />

  const totalPages = Math.ceil(profile.exams.length / ITEMS_PER_PAGE)
  const paginated = profile.exams.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div className="space-y-4">
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-3 py-3 font-medium">الامتحان</th>
            <th className="px-3 py-3 font-medium">الدورة</th>
            <th className="px-3 py-3 font-medium">الدرجة</th>
            <th className="px-3 py-3 font-medium">النسبة</th>
            <th className="px-3 py-3 font-medium">التاريخ</th>
            <th className="px-3 py-3 font-medium">النتيجة</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paginated.map((e) => {
            const pct = Math.round((e.score / e.total) * 100)
            return (
              <tr key={e.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-3 py-3 font-semibold text-foreground">{e.name}</td>
                <td className="px-3 py-3 text-muted-foreground">{e.course}</td>
                <td className="px-3 py-3 font-semibold text-foreground">
                  {e.score}/{e.total}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{pct}%</td>
                <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{e.date}</td>
                <td className="px-3 py-3">
                  <Pill tone={e.status === 'ناجح' ? 'success' : 'danger'}>{e.status}</Pill>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

function AssignmentsView({ profile }: { profile: StudentProfile }) {
  const [page, setPage] = useState(1)
  if (profile.assignments.length === 0) return <EmptyRow text="لا توجد واجبات" />

  const totalPages = Math.ceil(profile.assignments.length / ITEMS_PER_PAGE)
  const paginated = profile.assignments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div className="space-y-4">
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-3 py-3 font-medium">الواجب</th>
            <th className="px-3 py-3 font-medium">الدورة</th>
            <th className="px-3 py-3 font-medium">موعد التسليم</th>
            <th className="px-3 py-3 font-medium">الدرجة</th>
            <th className="px-3 py-3 font-medium">الحالة</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paginated.map((a) => (
            <tr key={a.id} className="transition-colors hover:bg-secondary/40">
              <td className="px-3 py-3 font-semibold text-foreground">{a.name}</td>
              <td className="px-3 py-3 text-muted-foreground">{a.course}</td>
              <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{a.dueDate}</td>
              <td className="px-3 py-3 text-foreground">{a.grade !== null ? `${a.grade}%` : '—'}</td>
              <td className="px-3 py-3">
                <Pill
                  tone={a.status === 'تم التسليم' ? 'success' : a.status === 'متأخر' ? 'warning' : 'danger'}
                >
                  {a.status}
                </Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
