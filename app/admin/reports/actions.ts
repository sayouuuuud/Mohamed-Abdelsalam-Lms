'use server'

import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
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
    .select(`
      id, title, students, price, category
    `)

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

  return {
    success: true,
    reportStats,
    monthlyRevenue,
    studentsGrowth,
    categoryDistribution,
    revenueByCategory,
    paymentStatus,
    coursePerformance,
  }
}
