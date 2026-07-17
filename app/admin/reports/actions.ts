'use server'

import { prisma } from '@/lib/prisma'
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
  const data = await prisma.reports.findMany({
    orderBy: { created_at: 'desc' }
  })

  return data.map((row) => {
    const d = new Date(row.created_at)
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      type: row.type,
      createdBy: row.created_by ?? '',
      createdAt: `${d.getDate()} ${d.toLocaleString('ar-EG', { month: 'short' })} ${d.getFullYear()}`,
      status: row.status ?? '',
    }
  })
}

export async function generateReport() {
  if (!(await hasResourceAccess('reports', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.reports.create({
      data: {
        code: `REP-${Math.floor(Math.random() * 900) + 100}`,
        title: 'تقرير مخصص جديد',
        type: 'أكاديمي',
        created_by: 'الأدمن',
        status: 'قيد التجهيز',
      }
    })

    logActivity({ action: 'create', resource: 'reports', targetLabel: 'تقرير مخصص جديد' }).catch(() => {})
    revalidatePath('/reports')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذر إنشاء التقرير.' }
  }
}

export async function getReportsData() {
  if (!(await hasResourceAccess('reports'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const [allOrders, studentsCount, studentsDataRaw, enrollmentsCount, enrollmentsRaw] = await Promise.all([
    prisma.orders.findMany({
      select: { id: true, status: true, total: true, created_at: true, order_items: { select: { lecture_title: true, branch_title: true, price: true, stage_title: true } } }
    }),
    prisma.students.count(),
    prisma.students.findMany({ select: { id: true, created_at: true } }),
    prisma.enrollments.count(),
    prisma.enrollments.findMany({ select: { id: true, enrolled_at: true } })
  ])

  const approvedOrders = allOrders.filter((o) => o.status === 'approved')
  const totalRevenue = approvedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const rejectedOrders = allOrders.filter((o) => o.status === 'rejected')
  const pendingOrders = allOrders.filter((o) => o.status === 'pending')

  const window = lastMonths(12)
  const windowStart = window[0].start

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const revThis = approvedOrders
    .filter((o) => new Date(o.created_at) >= thirtyDaysAgo)
    .reduce((s, o) => s + Number(o.total || 0), 0)
  const revPrev = approvedOrders
    .filter((o) => new Date(o.created_at) >= sixtyDaysAgo && new Date(o.created_at) < thirtyDaysAgo)
    .reduce((s, o) => s + Number(o.total || 0), 0)

  const studentsThis = studentsDataRaw.filter(
    (s) => new Date(s.created_at) >= thirtyDaysAgo
  ).length
  const studentsPrev = studentsDataRaw.filter(
    (s) => new Date(s.created_at) >= sixtyDaysAgo && new Date(s.created_at) < thirtyDaysAgo
  ).length

  const enrollThis = enrollmentsRaw.filter(
    (e) => e.enrolled_at && new Date(e.enrolled_at) >= thirtyDaysAgo
  ).length
  const enrollPrev = enrollmentsRaw.filter(
    (e) => e.enrolled_at && new Date(e.enrolled_at) >= sixtyDaysAgo && new Date(e.enrolled_at) < thirtyDaysAgo
  ).length

  const rejectedThis = rejectedOrders.filter(
    (o) => new Date(o.created_at) >= thirtyDaysAgo
  ).length
  const rejectedPrev = rejectedOrders.filter(
    (o) => new Date(o.created_at) >= sixtyDaysAgo && new Date(o.created_at) < thirtyDaysAgo
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

  const revenueBucket: Record<string, number> = {}
  approvedOrders.forEach((o) => {
    const k = monthKeyOf(o.created_at)
    revenueBucket[k] = (revenueBucket[k] || 0) + Number(o.total || 0)
  })
  const monthlyRevenue = window.map((b) => {
    const revenue = revenueBucket[b.key] || 0
    const prevD = new Date(b.start)
    prevD.setMonth(prevD.getMonth() - 1)
    const prevKey = monthKeyOf(prevD)
    const prevRevenue = revenueBucket[prevKey] || 0
    const target = prevRevenue === 0 ? revenue * 1.15 : prevRevenue * 1.15
    return { month: b.month, revenue, target: Math.round(target) }
  })

  const signupsBucket: Record<string, number> = {}
  let baseStudents = 0
  studentsDataRaw.forEach((s) => {
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

  const paymentStatus = [
    { name: 'مقبول', value: approvedOrders.length, fill: 'var(--chart-1)' },
    { name: 'قيد المراجعة', value: pendingOrders.length, fill: 'var(--chart-4)' },
    { name: 'مرفوض', value: rejectedOrders.length, fill: 'var(--chart-3)' },
  ].filter((s) => s.value > 0)

  const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

  const categoryCount: Record<string, number> = {}
  const categoryRevenue: Record<string, number> = {}
  
  approvedOrders.forEach((order) => {
    order.order_items.forEach((item) => {
      const catName = item.stage_title || item.branch_title || 'عام'
      categoryRevenue[catName] = (categoryRevenue[catName] || 0) + (Number(item.price) || 0)
      categoryCount[catName] = (categoryCount[catName] || 0) + 1
    })
  })

  const categoryDistribution = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, fill: colors[i % colors.length] }))

  const revenueByCategory = Object.entries(categoryRevenue)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, revenue], i) => ({ name, revenue, fill: colors[i % colors.length] }))

  const itemStats: Record<string, { title: string, category: string, students: number, revenue: number }> = {}
  let totalItemsRevenue = 0

  approvedOrders.forEach((order) => {
    order.order_items.forEach((item) => {
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
  if (!(await hasResourceAccess('reports'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    const data = await prisma.$queryRaw`SELECT * FROM get_advanced_analytics()`
    return { success: true, data }
  } catch (error: any) {
    console.error('Failed to fetch advanced analytics:', error)
    return { error: 'حدث خطأ أثناء جلب التحليلات المتقدمة' }
  }
}

export async function exportReportsCSV() {
  if (!(await hasResourceAccess('reports'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const data = await getReportsData()
  if ('error' in data) return { error: data.error }

  let csv = '\uFEFF'
  csv += 'تقرير المنصة الشامل\n\n'
  
  csv += 'ملخص الأداء\n'
  csv += 'المؤشر,القيمة\n'
  data.reportStats?.forEach((s: any) => {
    csv += `${s.label},${s.value} ${s.suffix || ''}\n`
  })
  csv += '\n'

  csv += 'الإيرادات الشهرية\n'
  csv += 'الشهر,الإيرادات (ج.م)\n'
  data.monthlyRevenue?.forEach((m: any) => {
    csv += `${m.month},${m.revenue}\n`
  })
  csv += '\n'

  csv += 'أداء الكورسات\n'
  csv += 'الكورس,القسم,عدد الطلاب,الإيرادات (ج.م)\n'
  data.coursePerformance?.forEach((c: any) => {
    csv += `"${c.title}","${c.category}",${c.students},${c.revenue}\n`
  })

  return { success: true, csv }
}
