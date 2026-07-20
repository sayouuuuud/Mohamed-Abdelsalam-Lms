'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import { createNotification } from '@/lib/notify'
import { revalidatePath } from 'next/cache'
import type { CalendarEvent, CalendarEventType } from '@/lib/calendar-data'

export async function getEvents(): Promise<CalendarEvent[]> {
  const data = await prisma.calendar_events.findMany({
    orderBy: [
      { event_date: 'desc' },
      { event_time: 'desc' }
    ]
  })

  return data.map((row) => ({
    id: row.code,
    title: row.title,
    date: row.event_date instanceof Date ? row.event_date.toISOString().split('T')[0] : String(row.event_date),
    time: row.event_time,
    type: row.type as CalendarEventType,
    course: row.course || undefined,
    description: row.description || undefined,
    custom: row.custom,
    stageId: row.stage_id || undefined,
    branchId: row.branch_id || undefined,
    lectureId: row.lecture_id || undefined,
  }))
}

export async function getTargetingOptions() {
  const [stages, branches, lectures] = await Promise.all([
    prisma.stages.findMany({ select: { id: true, title: true, sort_order: true }, orderBy: { sort_order: 'asc' } }),
    prisma.branches.findMany({ select: { id: true, stage_id: true, title: true, sort_order: true }, orderBy: { sort_order: 'asc' } }),
    prisma.lectures.findMany({ select: { id: true, branch_id: true, title: true, sort_order: true }, orderBy: { sort_order: 'asc' } }),
  ])

  return { stages, branches, lectures }
}

export async function createEvent(values: {
  title: string
  date: string
  time: string
  type: string
  course?: string
  description?: string
  stageId?: string | null
  branchId?: string | null
  lectureId?: string | null
}) {
  if (!(await hasResourceAccess('calendar', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const latest = await prisma.calendar_events.findFirst({
    select: { code: true },
    orderBy: { code: 'desc' }
  })

  let nextNum = 1
  if (latest && latest.code.startsWith('EVT-')) {
    const num = parseInt(latest.code.replace('EVT-', ''), 10)
    if (!isNaN(num)) nextNum = num + 1
  }
  const code = `EVT-${String(nextNum).padStart(2, '0')}`

  try {
    await prisma.calendar_events.create({
      data: {
        code,
        title: values.title,
        event_date: new Date(values.date).toISOString(),
        event_time: values.time,
        type: values.type,
        course: values.course || '',
        description: values.description || '',
        custom: true,
        stage_id: values.stageId,
        branch_id: values.branchId,
        lecture_id: values.lectureId,
      }
    })

    logActivity({ action: 'create', resource: 'calendar', targetId: code, targetLabel: `حدث: ${values.title}` }).catch(() => {})

    await createNotification({
      type: values.type === 'اختبار' ? 'اختبار' : 'نظام',
      title: `موعد جديد: ${values.title}`,
      description: `${values.date} - ${values.time}${values.course ? ` · ${values.course}` : ''}`,
    })

    revalidatePath('/calendar')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function updateEvent(
  id: string,
  values: {
    title: string
    date: string
    time: string
    type: string
    course?: string
    description?: string
    stageId?: string | null
    branchId?: string | null
    lectureId?: string | null
  },
) {
  if (!(await hasResourceAccess('calendar', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.calendar_events.update({
      where: { code: id },
      data: {
        title: values.title,
        event_date: new Date(values.date).toISOString(),
        event_time: values.time,
        type: values.type,
        course: values.course || '',
        description: values.description || '',
        stage_id: values.stageId,
        branch_id: values.branchId,
        lecture_id: values.lectureId,
      }
    })

    logActivity({ action: 'update', resource: 'calendar', targetId: id, targetLabel: `حدث: ${values.title}` }).catch(() => {})
    revalidatePath('/calendar')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function deleteEvent(id: string) {
  if (!(await hasResourceAccess('calendar', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.calendar_events.delete({ where: { code: id } })
    logActivity({ action: 'delete', resource: 'calendar', targetId: id, targetLabel: `حدث كود: ${id}` }).catch(() => {})
    revalidatePath('/calendar')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
