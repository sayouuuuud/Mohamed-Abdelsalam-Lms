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
  const { data: allOrders } = await supabase
    .from('orders')
    .select('id, status, total, created_at, order_items(lecture_title, branch_title, price, stage_title)')

  const { count: studentsCount, data: studentsDataRaw } = await supabase
    .from('students')
    .select('id, created_at', { count: 'exact' })

  const { count: enrollmentsCount, data: enrollmentsRaw } = await supabase
    .from('enrollments')
    .select('id, enrolled_at', { count: 'exact' })

  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, title, students, price, category')

  const approvedOrders = allOrders?.filter((o) => o.status === 'approved') || []
  const totalRevenue = approvedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const rejectedOrders = allOrders?.filter((o) => o.status === 'rejected') || []
  const pendingOrders = allOrders?.filter((o) => o.status === 'pending') || []

  // Real rolling 12-month window.
  const window = lastMonths(12)
  const windowStart = window[0].start
  const thisKey = window[window.length - 1].key
  const prevKey = window[window.length - 2].key

  // Period-over-period change = current month vs previous month.
  const revThis = approvedOrders
    .filter((o) => monthKeyOf(o.created_at) === thisKey)
    .reduce((s, o) => s + Number(o.total || 0), 0)
  const revPrev = approvedOrders
    .filter((o) => monthKeyOf(o.created_at) === prevKey)
    .reduce((s, o) => s + Number(o.total || 0), 0)

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

  const rejectedThis = rejectedOrders.filter(
    (o) => monthKeyOf(o.created_at) === thisKey,
  ).length
  const rejectedPrev = rejectedOrders.filter(
    (o) => monthKeyOf(o.created_at) === prevKey,
  ).length

  const revChange = percentChange(revThis, revPrev)
  const stuChange = percentChange(studentsThis, studentsPrev)
  const enrChange = percentChange(enrollThis, enrollPrev)
  const refChange = percentChange(rejectedThis, rejectedPrev)

  const reportStats = [
    { key: 'revenue', label: 'إجمالي الإيرادات', value: totalRevenue, suffix: 'ج.م', change: Math.abs(revChange), up: revChange >= 0 },
    { key: 'students', label: 'إجمالي الطلاب', value: studentsCount || 0, suffix: 'طالب', change: Math.abs(stuChange), up: stuChange >= 0 },
    { key: 'enrollments', label: 'الاشتراكات', value: enrollmentsCount || 0, suffix: 'اشتراك', change: Math.abs(enrChange), up: enrChange >= 0 },
    { key: 'refunds', label: 'المدفوعات المرفوضة', value: rejectedOrders.length, suffix: 'طلب', change: Math.abs(refChange), up: refChange <= 0 },
  ]

  // Monthly revenue vs a +15% stretch target (real revenue, derived target).
  const revenueBucket: Record<string, number> = {}
  approvedOrders.forEach((o) => {
    const k = monthKeyOf(o.created_at)
    revenueBucket[k] = (revenueBucket[k] || 0) + Number(o.total || 0)
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
    { name: 'مقبول', value: approvedOrders.length, fill: 'var(--chart-1)' },
    { name: 'قيد المراجعة', value: pendingOrders.length, fill: 'var(--chart-4)' },
    { name: 'مرفوض', value: rejectedOrders.length, fill: 'var(--chart-3)' },
  ].filter((s) => s.value > 0)

  const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
  const priceOf = (c: any) => Number(String(c.price ?? '').replace(/\D/g, '') || 0)
  const courseRevenue = (c: any) => priceOf(c) * (c.students || 0)

  // Students per category.
  const categoryCount: Record<string, number> = {}
  // Revenue per category (real, derived from orders)
  const categoryRevenue: Record<string, number> = {}
  
  approvedOrders?.forEach((order) => {
    order.order_items?.forEach((item: any) => {
      const catName = item.stage_title || item.branch_title || 'عام'
      categoryRevenue[catName] = (categoryRevenue[catName] || 0) + (Number(item.price) || 0)
    })
  })
  
  coursesData?.forEach((c) => {
    const catName = c.category || 'عام'
    categoryCount[catName] = (categoryCount[catName] || 0) + (c.students || 0)
  })

  const categoryDistribution = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, fill: colors[i % colors.length] }))

  const revenueByCategory = Object.entries(categoryRevenue)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, revenue], i) => ({ name, revenue, fill: colors[i % colors.length] }))

  // Course performance (Real data from orders and order_items)
  const itemStats: Record<string, { title: string, category: string, students: number, revenue: number }> = {}
  let totalItemsRevenue = 0

  approvedOrders?.forEach((order) => {
    order.order_items?.forEach((item: any) => {
      const key = item.lecture_title || 'غير معروف'
      if (!itemStats[key]) {
        itemStats[key] = { title: key, category: item.branch_title || 'عام', students: 0, revenue: 0 }
      }
      itemStats[key].students += 1
      const itemPrice = Number(item.price) || 0
      itemStats[key].revenue += itemPrice
      totalItemsRevenue += itemPrice
    })
  })

  const coursePerformance = Object.values(itemStats)
    .map((c) => ({
      ...c,
      share: totalItemsRevenue > 0 ? Math.round((c.revenue / totalItemsRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 50)

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

export async function getAdvancedAnalytics() {
  const supabase = await createClient()

  if (!(await hasResourceAccess(supabase, 'reports'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { data, error } = await supabase.rpc('get_advanced_analytics')

  if (error) {
    console.error('Failed to fetch advanced analytics:', error)
    return { error: 'حدث خطأ أثناء جلب التحليلات المتقدمة' }
  }

  return { success: true, data }
}
