'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentStudent } from '@/lib/auth-guard'
export type MonthlyStat = {
  label: string
  value: string | number
  change: string
  positive: boolean | null
}


function buildEmptyDays(days: number) {
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - ((days - 1) - i) * 24 * 60 * 60 * 1000)
    return {
      day: dayNames[d.getDay()],
      isoDate: d.toISOString().split('T')[0],
      hours: 0,
    }
  })
}

export async function getStudentLearningActivity(days: number = 7) {
  const student = await getCurrentStudent()
  if (!student) return buildEmptyDays(days)

  const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000)
  startDate.setHours(0,0,0,0)

  const rows = await prisma.learning_activity.findMany({
    where: {
      student_id: student.id,
      activity_date: { gte: startDate }
    },
    select: { activity_date: true, minutes: true },
    orderBy: { activity_date: 'asc' }
  })

  const minutesByDate = new Map<string, number>(
    rows.map((r) => [r.activity_date.toISOString().split('T')[0], r.minutes ?? 0])
  )

  return buildEmptyDays(days).map((day) => ({
    ...day,
    hours: parseFloat(((minutesByDate.get(day.isoDate) ?? 0) / 60).toFixed(1)),
  }))
}

export async function getStudentMonthlyProgress(): Promise<MonthlyStat[]> {
  const student = await getCurrentStudent()
  const empty: MonthlyStat[] = [
    { label: 'درس مكتمل', value: 0, change: 'ابدأ التعلّم الآن', positive: null },
    { label: 'ساعة تعلّم', value: 0, change: 'ابدأ التعلّم الآن', positive: null },
    { label: 'يوم نشاط متتالي', value: 0, change: 'لا يوجد نشاط بعد', positive: null },
    { label: 'متوسط الدرجات', value: '—', change: 'لا توجد درجات بعد', positive: null },
  ]
  if (!student || !student.user_id) return empty

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
  monthStartDate.setHours(0,0,0,0)

  const lessonsCount1 = await prisma.student_content_progress.count({
    where: {
      user_id: student.user_id,
      item_type: 'lesson',
      status: 'completed',
      updated_at: { gte: monthStart }
    }
  })

  const lessonsCount2 = await prisma.lesson_progress.count({
    where: {
      enrollments: {
        student_id: student.id
      },
      completed: true,
      completed_at: { gte: monthStart }
    }
  })

  const lessonsCount = lessonsCount1 + lessonsCount2

  const monthActivity = await prisma.learning_activity.findMany({
    where: {
      student_id: student.id,
      activity_date: { gte: monthStartDate }
    },
    select: { minutes: true }
  })
  
  const totalMinutes = monthActivity.reduce((sum, r) => sum + (r.minutes ?? 0), 0)
  const hoursRaw = totalMinutes / 60
  const hours = hoursRaw > 0 && hoursRaw < 1 ? Number(hoursRaw.toFixed(1)) : Math.round(hoursRaw)

  const allActivity = await prisma.learning_activity.findMany({
    where: { student_id: student.id },
    select: { activity_date: true },
    orderBy: { activity_date: 'desc' }
  })
  const activeDays = new Set(allActivity.map((r) => r.activity_date.toISOString().split('T')[0]))
  
  let streak = 0
  const cursor = new Date()
  const formatYMD = (d: Date) => d.toISOString().split('T')[0]

  if (!activeDays.has(formatYMD(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (activeDays.has(formatYMD(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  const asgSubs = await prisma.assignment_submissions.findMany({
    where: {
      student_id: student.id,
      score: { not: null as unknown as number },
      submitted_at: { gte: monthStart }
    },
    select: { score: true, assignments: { select: { points: true } } }
  })

  const examSubs = await prisma.exam_submissions.findMany({
    where: {
      student_id: student.id,
      grading_status: 'graded',
      submitted_at: { gte: monthStart }
    },
    select: { score: true, total: true }
  })

  const percentages: number[] = []
  for (const s of asgSubs) {
    const points = s.assignments?.points ?? 0
    if (points > 0 && s.score != null) percentages.push((s.score / points) * 100)
  }
  for (const s of examSubs) {
    const total = s.total ?? 0
    if (total > 0 && s.score != null) percentages.push((s.score / total) * 100)
  }

  const avgGrade =
    percentages.length > 0
      ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
      : null

  return [
    {
      label: 'درس مكتمل',
      value: lessonsCount ?? 0,
      change: 'خلال هذا الشهر',
      positive: (lessonsCount ?? 0) > 0 ? true : null,
    },
    {
      label: 'ساعة تعلّم',
      value: hours,
      change: 'خلال هذا الشهر',
      positive: hours > 0 ? true : null,
    },
    {
      label: 'يوم نشاط متتالي',
      value: streak,
      change: streak > 0 ? 'استمر في التعلّم!' : 'لا يوجد نشاط بعد',
      positive: streak > 0 ? true : null,
    },
    {
      label: 'متوسط الدرجات',
      value: avgGrade != null ? `${avgGrade}%` : '—',
      change: avgGrade != null ? `عن ${percentages.length} تقييم هذا الشهر` : 'لا توجد درجات بعد',
      positive: avgGrade != null ? avgGrade >= 60 : null,
    },
  ]
}
