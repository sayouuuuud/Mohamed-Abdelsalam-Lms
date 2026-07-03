'use client'

import { useEffect, useState } from 'react'
import { PanelCard } from '@/components/dashboard/panel-card'
import { FileText, ClipboardList, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStudentAssignments } from '@/app/student/actions'

type PendingItem = {
  id: string
  title: string
  type: 'تسليم' | 'اختبار'
  dueDate: string
  points: number
  status: string
  lectureTitle?: string
}

export function PendingAssignments() {
  const [items, setItems] = useState<PendingItem[] | null>(null)

  // Fetch real assignments on mount and refresh when the tab regains focus,
  // so newly-submitted items drop off the "مطلوبة" list automatically.
  useEffect(() => {
    let active = true
    async function load() {
      const data = (await getStudentAssignments()) as PendingItem[]
      if (!active) return
      // Only assignments the student has not yet submitted or been graded on.
      const pending = data.filter(
        (a) => a.status !== 'تم التسليم' && a.status !== 'مصحّح',
      )
      setItems(pending)
    }
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Loading skeleton
  if (items === null) {
    return (
      <PanelCard title="الواجبات المطلوبة" action="عرض الكل" actionHref="/student/assignments">
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <div className="size-8 shrink-0 animate-pulse rounded-lg bg-secondary" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
              </div>
            </li>
          ))}
        </ul>
      </PanelCard>
    )
  }

  // All caught up
  if (items.length === 0) {
    return (
      <PanelCard title="الواجبات المطلوبة" action="عرض الكل" actionHref="/student/assignments">
        <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="size-6 text-green-500" />
          </div>
          <p className="text-sm font-medium text-foreground">أحسنت! لا توجد واجبات مطلوبة</p>
          <p className="text-xs text-muted-foreground">لقد أنجزت كل ما هو مطلوب منك حالياً</p>
        </div>
      </PanelCard>
    )
  }

  return (
    <PanelCard title="الواجبات المطلوبة" action="عرض الكل" actionHref="/student/assignments">
      <ul className="space-y-0.5">
        {items.slice(0, 4).map((a) => {
          const isExam = a.type === 'اختبار'
          const Icon = isExam ? ClipboardList : FileText
          return (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-secondary/60"
            >
              <div
                className={cn(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                  isExam ? 'bg-primary/10' : 'bg-amber-500/10',
                )}
              >
                <Icon className={cn('size-4', isExam ? 'text-primary' : 'text-amber-500')} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                {a.lectureTitle && (
                  <p className="truncate text-xs text-muted-foreground">{a.lectureTitle}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    التسليم: {a.dueDate}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-semibold text-primary">{a.points} نقطة</span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </PanelCard>
  )
}
