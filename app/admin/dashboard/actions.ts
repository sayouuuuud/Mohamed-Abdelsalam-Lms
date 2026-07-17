'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { lastMonths, monthKeyOf, percentChange, getRangeStartDate, lastDays, dayKeyOf } from '@/lib/time-series'
import { getRelativeTimeArabic } from '@/lib/utils'

export async function getDashboardData() {
  if (!(await hasResourceAccess( 'dashboard'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  // Basic counts
  const studentsCount = await prisma.students.count()
  const monthlyCoursesCount = await prisma.monthly_courses.count()
  const coursesCount = await prisma.lectures.count()
  const lessonsCount = await prisma.lessons.count()

  // Latest 5 items
  const latestStudents = await prisma.students.findMany({
    select: { name: true, email: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 5
  })
  
  const latestCourses = await prisma.lectures.findMany({
    select: { id: true, title: true, created_at: true, price: true, image: true },
    orderBy: { created_at: 'desc' },
    take: 5
  })

  const latestLessons = await prisma.course_lessons.findMany({
    select: { title: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 5
  })

  // Top Courses (actually top lectures)
  const topCourses = await prisma.lectures.findMany({
    select: { title: true, price: true, image: true, _count: { select: { order_items: true } } },
    orderBy: { order_items: { _count: 'desc' } },
    take: 5
  })

  // We need to write Raw SQL for aggregating orders and submissions
  // because fetching everything into memory will crash the server.

  // --- Orders Aggregation ---
  const ordersSummary: any[] = await prisma.$queryRaw`
    SELECT 
      status, 
      method, 
      COUNT(*) as count, 
      SUM(total) as sum_total 
    FROM orders 
    GROUP BY status, method
  `
  let totalRevenue = 0
  let pendingPaymentsCount = 0
  let pendingPaymentsAmount = 0
  const statusBucket: Record<string, number> = { 'مقبول': 0, 'قيد المراجعة': 0, 'مرفوض': 0 }
  const methodBucket: Record<string, number> = {}

  ordersSummary.forEach(row => {
    const sum = Number(row.sum_total) || 0
    const count = Number(row.count) || 0
    if (row.status === 'approved') {
      totalRevenue += sum
      statusBucket['مقبول'] += count
      const m = row.method || 'غير محدد'
      methodBucket[m] = (methodBucket[m] || 0) + sum
    } else if (row.status === 'pending') {
      pendingPaymentsCount += count
      pendingPaymentsAmount += sum
      statusBucket['قيد المراجعة'] += count
    } else {
      statusBucket['مرفوض'] += count
    }
  })

  const paymentMethods = Object.entries(methodBucket)
    .map(([method, value], i) => ({ method, value, fill: `var(--chart-${(i % 5) + 1})` }))
    .sort((a, b) => b.value - a.value)

  const paymentStatus = [
    { name: 'مقبول', value: statusBucket['مقبول'] },
    { name: 'قيد المراجعة', value: statusBucket['قيد المراجعة'] },
    { name: 'مرفوض', value: statusBucket['مرفوض'] },
  ]

  // Monthly revenue and signups
  const monthlyWindow = lastMonths(12)
  const monthlyWindowStart = monthlyWindow[0].start

  const ordersMonthly: any[] = await prisma.$queryRaw`
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM') as month_key, 
      SUM(total) as sum_total 
    FROM orders 
    WHERE status = 'approved' AND created_at >= ${monthlyWindowStart}
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
  `
  const revenueBucket: Record<string, number> = {}
  ordersMonthly.forEach(row => {
    revenueBucket[row.month_key] = Number(row.sum_total) || 0
  })

  const studentsMonthly: any[] = await prisma.$queryRaw`
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM') as month_key, 
      COUNT(*) as count 
    FROM students 
    WHERE created_at >= ${monthlyWindowStart}
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
  `
  const signupsBucket: Record<string, number> = {}
  studentsMonthly.forEach(row => {
    signupsBucket[row.month_key] = Number(row.count) || 0
  })

  const baseStudentsQuery: any[] = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM students WHERE created_at < ${monthlyWindowStart}
  `
  let cumulativeStudents = Number(baseStudentsQuery[0]?.count) || 0

  const revenueData = monthlyWindow.map((b) => ({
    month: b.month,
    revenue: revenueBucket[b.key] || 0,
  }))

  const studentsData = monthlyWindow.map((b) => {
    cumulativeStudents += signupsBucket[b.key] || 0
    return { month: b.month, students: cumulativeStudents }
  })

  // Daily activity (30 days)
  const dailyWindow = lastDays(30)
  const dailyWindowStart = dailyWindow[0].start

  const ordersDaily: any[] = await prisma.$queryRaw`
    SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as day_key, COUNT(*) as count 
    FROM orders WHERE status = 'approved' AND created_at >= ${dailyWindowStart}
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
  `
  const studentsDaily: any[] = await prisma.$queryRaw`
    SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as day_key, COUNT(*) as count 
    FROM students WHERE created_at >= ${dailyWindowStart}
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
  `
  const activityBucket: Record<string, number> = {}
  ordersDaily.forEach(r => { activityBucket[r.day_key] = (activityBucket[r.day_key] || 0) + Number(r.count) })
  studentsDaily.forEach(r => { activityBucket[r.day_key] = (activityBucket[r.day_key] || 0) + Number(r.count) })
  
  const activityData = dailyWindow.map((b) => ({
    day: b.day,
    value: activityBucket[b.key] || 0,
  }))

  // Views & visitors
  const viewsDaily: any[] = await prisma.$queryRaw`
    SELECT day, views, uniques 
    FROM get_views_daily(${dailyWindowStart.toISOString()}::timestamptz)
  `
  const viewsBucket: Record<string, number> = {}
  const uniquesBucket: Record<string, number> = {}
  let totalViews = 0
  let totalVisitors = 0

  viewsDaily.forEach((row) => {
    const k = dayKeyOf(row.day)
    const v = Number(row.views || 0)
    const u = Number(row.uniques || 0)
    viewsBucket[k] = v
    uniquesBucket[k] = u
    totalViews += v
    totalVisitors += u
  })

  const viewsData = dailyWindow.map((b) => ({
    label: b.day,
    views: viewsBucket[b.key] || 0,
    visitors: uniquesBucket[b.key] || 0,
  }))

  // Period-over-period changes
  const thisKey = monthlyWindow[monthlyWindow.length - 1].key
  const prevKey = monthlyWindow[monthlyWindow.length - 2].key
  const revThisMonth = revenueBucket[thisKey] || 0
  const revPrevMonth = revenueBucket[prevKey] || 0
  const stuThisMonth = signupsBucket[thisKey] || 0
  const stuPrevMonth = signupsBucket[prevKey] || 0

  const todayStr = dayKeyOf(new Date())
  const yesterdayStr = dayKeyOf(new Date(Date.now() - 86400000))
  const salesToday = activityBucket[todayStr] || 0
  const salesYesterday = activityBucket[yesterdayStr] || 0

  const coursesThisMonthQuery: any[] = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM lectures WHERE TO_CHAR(created_at, 'YYYY-MM') = ${thisKey}
  `
  const coursesThisMonth = Number(coursesThisMonthQuery[0]?.count) || 0

  const changes = {
    revenue: percentChange(revThisMonth, revPrevMonth),
    students: percentChange(stuThisMonth, stuPrevMonth),
    sales: percentChange(salesToday, salesYesterday),
    coursesThisMonth,
  }

  // Latest Payments
  const latestOrders = await prisma.orders.findMany({
    select: { code: true, student_name: true, total: true, status: true, order_items: { select: { lecture_title: true }, take: 1 } },
    orderBy: { created_at: 'desc' },
    take: 5
  })
  const latestPayments = latestOrders.map((o, i) => ({
    id: o.code ? (o.code.startsWith('#') ? o.code : `#${o.code}`) : `#PAY-${String(1000 + i)}`,
    name: o.student_name,
    course: o.order_items?.[0]?.lecture_title || 'طلب عام',
    amount: `${o.total} ج.م`,
    status: o.status === 'approved' ? 'ناجح' : o.status === 'pending' ? 'معلّق' : 'مرفوض',
  }))

  // Latest Messages
  const messagesData = await prisma.messages.findMany({
    select: { content: true, created_at: true, is_read: true, sender_name: true },
    orderBy: { created_at: 'desc' },
    take: 5
  })
  const latestMessages = messagesData.map((m) => ({
    name: m.sender_name || 'طالب غير معروف',
    text: m.content,
    time: getRelativeTimeArabic(m.created_at),
    unread: !m.is_read,
  }))

  // Exam Analytics
  const topExams = await prisma.exams.findMany({
    select: { title: true, avg_score: true },
    orderBy: { participants: 'desc' },
    take: 6
  })
  const examScores = topExams.map((e) => ({
    name: e.title?.length > 16 ? e.title.slice(0, 16) + '…' : e.title || 'امتحان',
    avg: Math.round(Number(e.avg_score) || 0),
  }))

  const submissionsSummary: any[] = await prisma.$queryRaw`
    SELECT 
      SUM(CASE WHEN grading_status = 'pending' THEN 1 ELSE 0 END) as pending_grading,
      COUNT(*) as total_scored,
      SUM(score) as sum_score,
      SUM(total) as sum_total,
      SUM(CASE WHEN (score / NULLIF(total, 0) * 100) >= e.pass_mark THEN 1 ELSE 0 END) as pass_count,
      SUM(CASE WHEN (score / NULLIF(total, 0) * 100) < e.pass_mark THEN 1 ELSE 0 END) as fail_count,
      SUM(CASE WHEN (score / NULLIF(total, 0) * 100) < 50 THEN 1 ELSE 0 END) as dist_0_49,
      SUM(CASE WHEN (score / NULLIF(total, 0) * 100) >= 50 AND (score / NULLIF(total, 0) * 100) < 70 THEN 1 ELSE 0 END) as dist_50_69,
      SUM(CASE WHEN (score / NULLIF(total, 0) * 100) >= 70 AND (score / NULLIF(total, 0) * 100) < 85 THEN 1 ELSE 0 END) as dist_70_84,
      SUM(CASE WHEN (score / NULLIF(total, 0) * 100) >= 85 THEN 1 ELSE 0 END) as dist_85_100
    FROM exam_submissions s
    JOIN exams e ON s.exam_id = e.id
    WHERE s.total > 0
  `
  
  const subStats = submissionsSummary[0] || {}
  const pendingGrading = Number(subStats.pending_grading) || 0
  const passCount = Number(subStats.pass_count) || 0
  const failCount = Number(subStats.fail_count) || 0
  const totalGraded = passCount + failCount
  const passRate = totalGraded > 0 ? Math.round((passCount / totalGraded) * 100) : 0
  
  // Actually, computing avg score from sum(score)/sum(total) is better
  const sumScore = Number(subStats.sum_score) || 0
  const sumTotal = Number(subStats.sum_total) || 0
  const avgScorePct = sumTotal > 0 ? Math.round((sumScore / sumTotal) * 100) : 0

  const passFailData = [
    { name: 'ناجح', key: 'pass', value: passCount },
    { name: 'راسب', key: 'fail', value: failCount },
  ]

  const scoreDistribution = [
    { range: '٤٩-٠٪', count: Number(subStats.dist_0_49) || 0 },
    { range: '٦٩-٥٠٪', count: Number(subStats.dist_50_69) || 0 },
    { range: '٨٤-٧٠٪', count: Number(subStats.dist_70_84) || 0 },
    { range: '١٠٠-٨٥٪', count: Number(subStats.dist_85_100) || 0 },
  ]

  return {
    examStats: { passRate, avgScorePct, pendingGrading, pendingPaymentsCount, pendingPaymentsAmount },
    examScores,
    passFailData,
    scoreDistribution,
    paymentMethods,
    paymentStatus,
    success: true,
    stats: {
      totalRevenue,
      totalStudents: studentsCount,
      totalMonthlyCourses: monthlyCoursesCount,
      totalCourses: coursesCount,
      totalLessons: lessonsCount,
      salesToday,
      changes,
    },
    revenueData,
    studentsData,
    activityData,
    viewsData,
    totalViews,
    totalVisitors,
    topCourses: topCourses.map((c) => ({
      title: c.title,
      students: `${c._count.order_items} طالب`,
      revenue: `${Number(c.price || 0) * (c._count.order_items || 0)} ج.م`,
      image: c.image || '/courses/python.png',
    })),
    latestPayments,
    latestStudents: latestStudents.map((s) => ({
      name: s.name,
      email: s.email,
      time: getRelativeTimeArabic(s.created_at),
    })),
    latestLessons: latestLessons.map((l) => ({
      title: l.title,
      time: getRelativeTimeArabic(l.created_at),
      image: '/courses/javascript.png',
    })),
    latestMessages,
  }
}
