'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  type CalendarEvent,
  type CalendarEventType,
} from '@/lib/calendar-data'
import { createEvent, updateEvent, deleteEvent } from '@/app/admin/calendar/actions'

export type EventFormValues = {
  title: string
  date: string
  time: string
  type: CalendarEventType
  course?: string
  description?: string
  stageId?: string | null
  branchId?: string | null
  lectureId?: string | null
}

export type TargetingOptions = {
  stages: { id: string; title: string }[]
  branches: { id: string; stage_id: string; title: string }[]
  lectures: { id: string; branch_id: string; title: string }[]
}

type CalendarContextValue = {
  events: CalendarEvent[]
  targetingOptions: TargetingOptions
  /** الشهر المعروض حاليًا */
  current: Date
  goToMonth: (offset: number) => void
  goToToday: () => void
  selectedDate: string | null
  setSelectedDate: (date: string | null) => void
  openCreate: (date?: string) => void
  openEdit: (event: CalendarEvent) => void
  requestDelete: (event: CalendarEvent) => void
  formOpen: boolean
  editing: CalendarEvent | null
  presetDate: string | null
  closeForm: () => void
  submitForm: (values: EventFormValues) => void
  deleting: CalendarEvent | null
  closeDelete: () => void
  confirmDelete: () => void
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

export function useCalendar() {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider')
  return ctx
}

export function CalendarProvider({ 
  children,
  initialEvents,
  targetingOptions,
}: { 
  children: ReactNode
  initialEvents: CalendarEvent[]
  targetingOptions: TargetingOptions
}) {
  const router = useRouter()
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [current, setCurrent] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [presetDate, setPresetDate] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null)

  const value = useMemo<CalendarContextValue>(
    () => ({
      events,
      targetingOptions,
      current,
      goToMonth: (offset) =>
        setCurrent((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1)),
      goToToday: () => {
        const d = new Date()
        setCurrent(new Date(d.getFullYear(), d.getMonth(), 1))
      },
      selectedDate,
      setSelectedDate,
      openCreate: (date) => {
        setEditing(null)
        setPresetDate(date ?? null)
        setFormOpen(true)
      },
      openEdit: (event) => {
        setEditing(event)
        setPresetDate(null)
        setFormOpen(true)
      },
      requestDelete: (event) => setDeleting(event),
      formOpen,
      editing,
      presetDate,
      closeForm: () => {
        setFormOpen(false)
        setEditing(null)
        setPresetDate(null)
      },
      submitForm: async (values) => {
        if (editing) {
          const original = [...events]
          setEvents((prev) =>
            prev.map((e) => (e.id === editing.id ? { ...e, ...values } : e)),
          )
          setFormOpen(false)
          setEditing(null)
          setPresetDate(null)
          
          const res = await updateEvent(editing.id, values)
          if (res.error) {
            toast.error(res.error)
            setEvents(original)
          } else {
            toast.success('تم تحديث الحدث بنجاح')
            router.refresh()
          }
        } else {
          setFormOpen(false)
          const res = await createEvent(values)
          if (res.error) {
            toast.error(res.error)
          } else {
            toast.success('تمت إضافة الحدث إلى التقويم')
            router.refresh()
          }
        }
      },
      deleting,
      closeDelete: () => setDeleting(null),
      confirmDelete: async () => {
        if (deleting) {
          const original = [...events]
          setEvents((prev) => prev.filter((e) => e.id !== deleting.id))
          const id = deleting.id
          setDeleting(null)
          
          const res = await deleteEvent(id)
          if (res.error) {
            toast.error(res.error)
            setEvents(original)
          } else {
            toast.success('تم حذف الحدث')
            router.refresh()
          }
        } else {
          setDeleting(null)
        }
      },
    }),
    [events, current, selectedDate, formOpen, editing, presetDate, deleting],
  )

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}
