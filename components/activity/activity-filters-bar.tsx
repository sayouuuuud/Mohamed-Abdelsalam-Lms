'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RotateCcw } from 'lucide-react'
import type { ActivityFilters, AuthFilters, ActorOption } from '@/app/admin/activity/actions'

const RESOURCES = [
  { value: '', label: 'كل الموارد' },
  { value: 'students', label: 'الطلاب' },
  { value: 'courses', label: 'المحاضرات' },
  { value: 'categories', label: 'التصنيفات' },
  { value: 'exams', label: 'الاختبارات' },
  { value: 'calendar', label: 'التقويم' },
  { value: 'payments', label: 'الطلبات' },
  { value: 'messages', label: 'الرسائل' },
  { value: 'notifications', label: 'الإشعارات' },
  { value: 'coupons', label: 'الكوبونات' },
  { value: 'reports', label: 'التقارير' },
  { value: 'settings', label: 'الإعدادات' },
]

const ACTIONS = [
  { value: '', label: 'كل الأفعال' },
  { value: 'create', label: 'إضافة' },
  { value: 'update', label: 'تعديل' },
  { value: 'delete', label: 'حذف' },
  { value: 'approve', label: 'قبول' },
  { value: 'reject', label: 'رفض' },
]

const AUTH_EVENTS = [
  { value: '', label: 'كل الأحداث' },
  { value: 'login', label: 'دخول' },
  { value: 'logout', label: 'خروج' },
]

type Props =
  | { mode: 'activity'; actors: ActorOption[]; onChange: (f: Omit<ActivityFilters, 'page'>) => void }
  | { mode: 'auth'; actors: ActorOption[]; onChange: (f: Omit<AuthFilters, 'page'>) => void }

export function ActivityFiltersBar({ mode, actors, onChange }: Props) {
  const [actorId, setActorId] = useState('')
  const [resource, setResource] = useState('')
  const [action, setAction] = useState('')
  const [event, setEvent] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  function emit(patch: object) {
    if (mode === 'activity') {
      ;(onChange as any)({ actorId: actorId || undefined, resource: resource || undefined, action: action || undefined, from: from || undefined, to: to || undefined, ...patch })
    } else {
      ;(onChange as any)({ actorId: actorId || undefined, event: event || undefined, from: from || undefined, to: to || undefined, ...patch })
    }
  }

  function reset() {
    setActorId(''); setResource(''); setAction(''); setEvent(''); setFrom(''); setTo('')
    if (mode === 'activity') (onChange as any)({})
    else (onChange as any)({})
  }

  const selectClass = 'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Actor */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">بواسطة</label>
          <select
            className={selectClass}
            value={actorId}
            onChange={(e) => { setActorId(e.target.value); emit({ actorId: e.target.value || undefined }) }}
          >
            <option value="">الكل</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.role === 'admin' ? 'أدمن' : 'مساعد'})</option>
            ))}
          </select>
        </div>

        {/* Resource (activity only) */}
        {mode === 'activity' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">المورد</label>
            <select
              className={selectClass}
              value={resource}
              onChange={(e) => { setResource(e.target.value); emit({ resource: e.target.value || undefined }) }}
            >
              {RESOURCES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        )}

        {/* Action (activity only) */}
        {mode === 'activity' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">نوع الفعل</label>
            <select
              className={selectClass}
              value={action}
              onChange={(e) => { setAction(e.target.value); emit({ action: e.target.value || undefined }) }}
            >
              {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        )}

        {/* Event (auth only) */}
        {mode === 'auth' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">الحدث</label>
            <select
              className={selectClass}
              value={event}
              onChange={(e) => { setEvent(e.target.value); emit({ event: e.target.value || undefined }) }}
            >
              {AUTH_EVENTS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
        )}

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">من</label>
          <input
            type="date"
            className={selectClass}
            value={from}
            onChange={(e) => { setFrom(e.target.value); emit({ from: e.target.value || undefined }) }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">إلى</label>
          <input
            type="date"
            className={selectClass}
            value={to}
            onChange={(e) => { setTo(e.target.value); emit({ to: e.target.value || undefined }) }}
          />
        </div>

        {/* Reset */}
        <Button variant="outline" size="sm" onClick={reset} className="mb-0.5">
          <RotateCcw className="size-3.5" />
          إعادة ضبط
        </Button>
      </div>
    </Card>
  )
}
