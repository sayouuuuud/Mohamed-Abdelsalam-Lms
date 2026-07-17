'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentStudent } from '@/lib/auth-guard'

export async function getStudentCalendarFilters(student: any) {
  const profile = await prisma.profiles.findUnique({
    where: { id: student.user_id },
    select: { grade: true }
  })
  const gradeSlug = profile?.grade

  let stageId = null
  if (gradeSlug) {
    const stage = await prisma.stages.findFirst({
      where: { slug: gradeSlug },
      select: { id: true }
    })
    stageId = stage?.id
  }

  const enrollments = await prisma.enrollments.findMany({
    where: { student_id: student.id },
    select: { course_id: true }
  })
  const lectureIds = enrollments.map((e) => e.course_id).filter(Boolean) as string[]

  let branchIds: string[] = []
  if (lectureIds.length > 0) {
    const lectures = await prisma.lectures.findMany({
      where: { id: { in: lectureIds } },
      select: { branch_id: true }
    })
    branchIds = Array.from(new Set(lectures.map((l) => l.branch_id).filter(Boolean))) as string[]
  }

  return { stageId, branchIds, lectureIds }
}

export async function getStudentUpcomingSchedule() {
  const student = await getCurrentStudent()
  if (!student) return []

  const filters = await getStudentCalendarFilters(student)

  const OR_conditions: any[] = []
  if (filters.stageId) {
    OR_conditions.push({ stage_id: filters.stageId })
  } else {
    OR_conditions.push({ stage_id: null })
  }
  
  if (filters.branchIds.length > 0) {
    OR_conditions.push({ branch_id: { in: filters.branchIds } })
  } else {
    OR_conditions.push({ branch_id: null })
  }

  if (filters.lectureIds.length > 0) {
    OR_conditions.push({ lecture_id: { in: filters.lectureIds } })
  } else {
    OR_conditions.push({ lecture_id: null })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const events = await prisma.calendar_events.findMany({
    where: {
      OR: OR_conditions,
      event_date: { gte: today }
    },
    orderBy: { event_date: 'asc' },
    take: 5
  })

  return events.map((e) => ({
    id: e.code ?? e.id,
    title: e.title,
    course: e.course || 'عام',
    type: (e.type === 'محاضرة' || e.type === 'اختبار' || e.type === 'واجب' || e.type === 'مراجعة' || e.type === 'مباشر') ? (e.type as 'محاضرة' | 'اختبار' | 'واجب' | 'مراجعة' | 'مباشر') : 'محاضرة',
    day: new Date(e.event_date).toLocaleDateString('ar-EG', { weekday: 'long' }),
    date: new Date(e.event_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }),
    time: e.event_time,
  }))
}

export async function getStudentFullSchedule() {
  const student = await getCurrentStudent()
  if (!student) return []

  const filters = await getStudentCalendarFilters(student)
  
  const OR_conditions: any[] = []
  if (filters.stageId) {
    OR_conditions.push({ stage_id: filters.stageId })
  } else {
    OR_conditions.push({ stage_id: null })
  }
  
  if (filters.branchIds.length > 0) {
    OR_conditions.push({ branch_id: { in: filters.branchIds } })
  } else {
    OR_conditions.push({ branch_id: null })
  }

  if (filters.lectureIds.length > 0) {
    OR_conditions.push({ lecture_id: { in: filters.lectureIds } })
  } else {
    OR_conditions.push({ lecture_id: null })
  }

  const events = await prisma.calendar_events.findMany({
    where: { OR: OR_conditions },
    orderBy: { event_date: 'asc' }
  })

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    date: new Date(e.event_date).toISOString().split('T')[0],
    time: e.event_time,
    type: (e.type === 'محاضرة' || e.type === 'اختبار' || e.type === 'واجب' || e.type === 'مراجعة' || e.type === 'مباشر') ? (e.type as 'محاضرة' | 'اختبار' | 'واجب' | 'مراجعة' | 'مباشر') : 'محاضرة',
    course: e.course || 'عام',
    description: e.description || '',
  }))
}
