'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Pencil, Check, X, Target } from 'lucide-react'
import { PanelCard } from '@/components/dashboard/panel-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getWeeklyGoals, updateWeeklyGoals } from '@/app/student/actions'
import type { WeeklyGoal, WeeklyGoalKey, WeeklyGoalTargets } from '@/lib/student-types'

const COLORS: Record<WeeklyGoalKey, string> = {
  lessons: 'bg-primary',
  hours: 'bg-blue-500',
  assignments: 'bg-amber-500',
  exams: 'bg-green-500',
}

export function WeeklyGoals() {
  // البيانات الحقيقية من الخادم — تتحدّث تلقائياً عند العودة للصفحة/التركيز.
  const { data: goals, isLoading, mutate } = useSWR<WeeklyGoal[]>(
    'weekly-goals',
    () => getWeeklyGoals(),
    { revalidateOnFocus: true },
  )

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<WeeklyGoalTargets | null>(null)

  function startEdit() {
    if (!goals) return
    setDraft({
      lessons: goals.find((g) => g.key === 'lessons')?.target ?? 7,
      hours: goals.find((g) => g.key === 'hours')?.target ?? 14,
      assignments: goals.find((g) => g.key === 'assignments')?.target ?? 3,
      exams: goals.find((g) => g.key === 'exams')?.target ?? 2,
    })
    setEditing(true)
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    // تحديث متفائل: نعرض الأهداف الجديدة فوراً مع الإبقاء على التقدّم الحالي.
    await mutate(
      async () => {
        await updateWeeklyGoals(draft)
        return getWeeklyGoals()
      },
      {
        optimisticData: (goals ?? []).map((g) => ({
          ...g,
          target: draft[g.key],
        })),
        revalidate: true,
      },
    )
    setSaving(false)
    setEditing(false)
  }

  return (
    <PanelCard
      title="أهدافك الأسبوعية"
      actionSlot={
        !editing && goals && goals.length > 0 ? (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="size-3.5" />
            تعديل
          </button>
        ) : null
      }
    >
      {isLoading || !goals ? (
        <ul className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="space-y-1.5">
              <div className="h-4 w-full animate-pulse rounded bg-secondary" />
              <div className="h-2 w-full animate-pulse rounded-full bg-secondary" />
            </li>
          ))}
        </ul>
      ) : editing && draft ? (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">{goal.label}</span>
              <Input
                type="number"
                min={1}
                max={99}
                value={draft[goal.key]}
                onChange={(e) =>
                  setDraft({ ...draft, [goal.key]: Number(e.target.value) })
                }
                className="h-8 w-20 text-center"
                dir="ltr"
              />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={saving} className="flex-1">
              <Check className="size-4" />
              {saving ? 'جارٍ الحفظ…' : 'حفظ الأهداف'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {goals.map((goal) => {
              const pct = goal.target
                ? Math.min(Math.round((goal.current / goal.target) * 100), 100)
                : 0
              const done = goal.current >= goal.target
              return (
                <li key={goal.key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm text-foreground">
                      {goal.label}
                      {done && <Check className="size-3.5 text-green-500" />}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {goal.current}/{goal.target}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        done ? 'bg-green-500' : COLORS[goal.key],
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <Target className="size-3.5" />
            يتحدّث تلقائياً ويتجدّد كل يوم أحد
          </p>
        </>
      )}
    </PanelCard>
  )
}
