'use server'

import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit-log'
import { lastMonths, monthKeyOf, percentChange } from '@/lib/time-series'

export type ReportItem = {
  id: string
  code: string
  title: string
  type: string
  createdBy: string
  createdAt: string
  status: string
}

export async function getReports(): Promise<ReportItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => {
    const d = new Date(row.created_at)
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      type: row.type,
      createdBy: row.created_by,
      createdAt: `${d.getDate()} ${d.toLocaleString('ar-EG', { month: 'short' })} ${d.getFullYear()}`,
      status: row.status,
    }
  })
}

export async function generateReport() {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'reports', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase
    .from('reports')
    .insert({
      code: `REP-${Math.floor(Math.random() * 900) + 100}`,
      title: 'تقرير مخصص جديد',
      type: 'أكاديمي',
      created_by: 'الأدمن',
      status: 'قيد التجهيز',
    })

  if (error) return { error: error.message }
  logActivity({ action: 'create', resource: 'reports', targetLabel: 'تقرير مخصص جديد' }).catch(() => {})
  revalidatePath('/reports')
  return { success: true }
}

export async function getReportsData() {
  const supabase = await createClient()

  if (!(await hasResourceAccess(supabase, 'reports'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  // Fetch all necessary data
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, status, created_at, course')

  const { count: studentsCount, data: studentsDataRaw } = await supabase
    .from('students')
    .select('id, created_at', { count: 'exact' })

  const { count: enrollmentsCount, data: enrollmentsRaw } = await supabase
    .from('enrollments')
    .select('id, enrolled_at', { count: 'exact' })

  const { data: coursesData } = await supabase
    .from('courses')
    .select(`id, title, students, price, category`)

  // Top students by enrollment count
  const { data: topStudentsRaw } = await supabase
    .from('enrollments')
    .select('student_id, students(name)')

  // Page views for the last 30 days (for views widget)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: viewsRaw } = await supabase
    .from('page_views')
    .select('visited_at, visitor_id, device')
    .gte('visited_at', thirtyDaysAgo)

  // Exam scores for performance analysis
  const { data: examResultsRaw } = await supabase
    .from('exam_results')
    .select('score, passed, exam_id')

  const approvedPayments = payments?.filter((p) => p.status === 'مقبول') || []
  const totalRevenue = approvedPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const rejectedPayments = payments?.filter((p) => p.status === 'مرفوض') || []
  const pendingPayments = payments?.filter((p) => p.status === 'قيد المراجعة') || []

  // Real rolling 12-month window.
  const window = lastMonths(12)
  const windowStart = window[0].start
  const thisKey = window[window.length - 1].key
  const prevKey = window[window.length - 2].key

  // Period-over-period change = current month vs previous month.
  const revThis = approvedPayments
    .filter((p) => monthKeyOf(p.created_at) === thisKey)
    .reduce((s, p) => s + Number(p.amount), 0)
  const revPrev = approvedPayments
    .filter((p) => monthKeyOf(p.created_at) === prevKey)
    .reduce((s, p) => s + Number(p.amount), 0)

  const studentsThis = (studentsDataRaw || []).filter(
    (s) => monthKeyOf(s.created_at) === thisKey,
  ).length
  const studentsPrev = (studentsDataRaw || []).filter(
    (s) => monthKeyOf(s.created_at) === prevKey,
  ).length

  const enrollThis = (enrollmentsRaw || []).filter(
    (e: any) => e.enrolled_at && monthKeyOf(e.enrolled_at) === thisKey,
  ).length
  const enrollPrev = (enrollmentsRaw || []).filter(
    (e: any) => e.enrolled_at && monthKeyOf(e.enrolled_at) === prevKey,
  ).length

  const rejectedThis = rejectedPayments.filter(
    (p) => monthKeyOf(p.created_at) === thisKey,
  ).length
  const rejectedPrev = rejectedPayments.filter(
    (p) => monthKeyOf(p.created_at) === prevKey,
  ).length

  const revChange = percentChange(revThis, revPrev)
  const stuChange = percentChange(studentsThis, studentsPrev)
  const enrChange = percentChange(enrollThis, enrollPrev)
  const refChange = percentChange(rejectedThis, rejectedPrev)

  const reportStats = [
    { key: 'revenue', label: 'إجمالي الإيرادات', value: totalRevenue, suffix: 'ج.م', change: Math.abs(revChange), up: revChange >= 0 },
    { key: 'students', label: 'إجمالي الطلاب', value: studentsCount || 0, suffix: 'طالب', change: Math.abs(stuChange), up: stuChange >= 0 },
    { key: 'enrollments', label: 'الاشتراكات', value: enrollmentsCount || 0, suffix: 'اشتراك', change: Math.abs(enrChange), up: enrChange >= 0 },
    { key: 'refunds', label: 'المدفوعات المرفوضة', value: rejectedPayments.length, suffix: 'طلب', change: Math.abs(refChange), up: refChange <= 0 },
  ]

  // Monthly revenue vs a +15% stretch target (real revenue, derived target).
  const revenueBucket: Record<string, number> = {}
  approvedPayments.forEach((p) => {
    const k = monthKeyOf(p.created_at)
    revenueBucket[k] = (revenueBucket[k] || 0) + Number(p.amount)
  })
  const monthlyRevenue = window.map((b) => {
    const revenue = revenueBucket[b.key] || 0
    return { month: b.month, revenue, target: Math.round(revenue * 1.15) }
  })

  // Cumulative students growth over the window.
  const signupsBucket: Record<string, number> = {}
  let baseStudents = 0
  studentsDataRaw?.forEach((s) => {
    const date = new Date(s.created_at)
    if (date < windowStart) {
      baseStudents += 1
      return
    }
    signupsBucket[monthKeyOf(date)] = (signupsBucket[monthKeyOf(date)] || 0) + 1
  })
  let cumulativeStudents = baseStudents
  const studentsGrowth = window.map((b) => {
    cumulativeStudents += signupsBucket[b.key] || 0
    return { month: b.month, students: cumulativeStudents }
  })

  // Payment status distribution (real counts).
  const paymentStatus = [
    { name: 'مقبول', value: approvedPayments.length, fill: 'var(--chart-1)' },
    { name: 'قيد المراجعة', value: pendingPayments.length, fill: 'var(--chart-4)' },
    { name: 'مرفوض', value: rejectedPayments.length, fill: 'var(--chart-3)' },
  ].filter((s) => s.value > 0)

  const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
  const priceOf = (c: any) => Number(String(c.price ?? '').replace(/\D/g, '') || 0)
  const courseRevenue = (c: any) => priceOf(c) * (c.students || 0)

  // Students per category.
  const categoryCount: Record<string, number> = {}
  // Revenue per category (real, derived from price × enrolled students).
  const categoryRevenue: Record<string, number> = {}
  coursesData?.forEach((c) => {
    const catName = c.category || 'عام'
    categoryCount[catName] = (categoryCount[catName] || 0) + (c.students || 0)
    categoryRevenue[catName] = (categoryRevenue[catName] || 0) + courseRevenue(c)
  })

  const categoryDistribution = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, fill: colors[i % colors.length] }))

  const revenueByCategory = Object.entries(categoryRevenue)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, revenue], i) => ({ name, revenue, fill: colors[i % colors.length] }))

  // Course performance ranked by real revenue, with each course's share of the
  // platform's total course revenue (replaces the previous mocked completion /
  // rating columns).
  const totalCourseRevenue =
    (coursesData || []).reduce((s, c) => s + courseRevenue(c), 0) || 1
  const coursePerformance = (coursesData || [])
    .map((c) => ({
      title: c.title,
      category: c.category || 'عام',
      students: c.students || 0,
      revenue: courseRevenue(c),
      share: Math.round((courseRevenue(c) / totalCourseRevenue) * 1000) / 10,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // ── Conversion funnel ─────────────────────────────────────────────────────
  const totalVisitors = viewsRaw ? new Set(viewsRaw.map((v) => v.visitor_id)).size : 0
  const conversionFunnel = [
    { stage: 'الزوّار', value: totalVisitors || 0, fill: 'var(--chart-1)' },
    { stage: 'المسجّلون', value: studentsCount || 0, fill: 'var(--chart-2)' },
    { stage: 'المشتركون', value: (enrollmentsRaw || []).length, fill: 'var(--chart-3)' },
    {
      stage: 'المدفوعون',
      value: new Set(approvedPayments.map((p: any) => p.student_id)).size || approvedPayments.length,
      fill: 'var(--chart-4)',
    },
  ]

  // ── Top students by enrollment count ────────────────────────────────────
  const studentEnrollCount: Record<string, number> = {}
  ;(topStudentsRaw || []).forEach((e: any) => {
    if (!e.student_id) return
    studentEnrollCount[e.student_id] = (studentEnrollCount[e.student_id] || 0) + 1
  })
  const topStudents = Object.entries(studentEnrollCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([student_id, courses]) => ({ student_id, courses }))

  // ── Device breakdown from page_views ───────────────────────────────────
  const deviceCount: Record<string, number> = {}
  ;(viewsRaw || []).forEach((v: any) => {
    const d = v.device || 'unknown'
    deviceCount[d] = (deviceCount[d] || 0) + 1
  })
  const deviceBreakdown = Object.entries(deviceCount)
    .sort((a, b) => b[1] - a[1])
    .map(([device, count]) => ({
      device,
      count,
      fill: device === 'mobile' ? 'var(--chart-1)' : device === 'desktop' ? 'var(--chart-2)' : 'var(--chart-3)',
    }))

  // ── Daily page views for last 30 days (heatmap) ─────────────────────────
  const dayViewsMap: Record<string, { views: number; uniques: Set<string> }> = {}
  ;(viewsRaw || []).forEach((v: any) => {
    const day = v.visited_at?.slice(0, 10)
    if (!day) return
    if (!dayViewsMap[day]) dayViewsMap[day] = { views: 0, uniques: new Set() }
    dayViewsMap[day].views += 1
    if (v.visitor_id) dayViewsMap[day].uniques.add(v.visitor_id)
  })
  const dailyViews = Object.entries(dayViewsMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, val]) => ({ day, views: val.views, visitors: val.uniques.size }))

  // ── Exam performance analytics ──────────────────────────────────────────
  const examScores = (examResultsRaw || []).map((r: any) => Number(r.score || 0))
  const examAvg = examScores.length ? Math.round(examScores.reduce((s, v) => s + v, 0) / examScores.length) : 0
  const examPassed = (examResultsRaw || []).filter((r: any) => r.passed).length
  const examFailed = (examResultsRaw || []).length - examPassed
  const scoreRanges = [
    { range: '0–49', count: examScores.filter((s) => s < 50).length, fill: 'var(--chart-3)' },
    { range: '50–69', count: examScores.filter((s) => s >= 50 && s < 70).length, fill: 'var(--chart-4)' },
    { range: '70–84', count: examScores.filter((s) => s >= 70 && s < 85).length, fill: 'var(--chart-2)' },
    { range: '85–100', count: examScores.filter((s) => s >= 85).length, fill: 'var(--chart-1)' },
  ]

  // ── Period comparison (this month vs last month) ─────────────────────────
  const periodComparison = [
    {
      label: 'الإيرادات',
      current: revThis,
      previous: revPrev,
      suffix: 'ج.م',
      change: revChange,
      up: revChange >= 0,
    },
    {
      label: 'الطلاب الجدد',
      current: studentsThis,
      previous: studentsPrev,
      suffix: 'طالب',
      change: stuChange,
      up: stuChange >= 0,
    },
    {
      label: 'الاشتراكات',
      current: enrollThis,
      previous: enrollPrev,
      suffix: 'اشتراك',
      change: enrChange,
      up: enrChange >= 0,
    },
  ]

  return {
    success: true,
    reportStats,
    monthlyRevenue,
    studentsGrowth,
    categoryDistribution,
    revenueByCategory,
    paymentStatus,
    coursePerformance,
    // New widgets
    conversionFunnel,
    topStudents,
    deviceBreakdown,
    dailyViews,
    examAvg,
    examPassed,
    examFailed,
    scoreRanges,
    periodComparison,
  }
}
