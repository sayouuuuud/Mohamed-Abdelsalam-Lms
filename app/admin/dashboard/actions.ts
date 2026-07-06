'use server'

import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { lastMonths, monthKeyOf, percentChange } from '@/lib/time-series'

export async function getDashboardData() {
  const supabase = await createClient()

  if (!(await hasResourceAccess(supabase, 'dashboard'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  // Fetch basic stats
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, status, created_at, method, student_name, course')
    .order('created_at', { ascending: false })

  const { count: studentsCount, data: latestStudentsData } = await supabase
    .from('students')
    .select('id, name, email, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  const { count: coursesCount, data: latestCoursesData } = await supabase
    .from('courses')
    .select('id, title, status, created_at, students, price, image', { count: 'exact' })
    .order('created_at', { ascending: false })

  const { count: lessonsCount } = await supabase
    .from('course_lessons')
    .select('id', { count: 'exact' })

  // Exam analytics source data.
  const { data: examsData } = await supabase
    .from('exams')
    .select('id, title, avg_score, pass_mark, participants')
    .order('participants', { ascending: false })

  const { data: submissionsData } = await supabase
    .from('exam_submissions')
    .select('exam_id, score, total, grading_status')

  // Processing Stats
  const approvedPayments = payments?.filter((p) => p.status === 'مقبول') || []
  const totalRevenue = approvedPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  // Real rolling 12-month series, bucketed by the actual calendar month each
  // payment / signup happened in. Charts slice the last 3/6/12 client-side.
  const window = lastMonths(12)
  const windowStart = window[0].start

  // Revenue per month.
  const revenueBucket: Record<string, number> = {}
  approvedPayments.forEach((p) => {
    const k = monthKeyOf(p.created_at)
    revenueBucket[k] = (revenueBucket[k] || 0) + Number(p.amount)
  })
  const revenueData = window.map((b) => ({
    month: b.month,
    revenue: revenueBucket[b.key] || 0,
  }))

  // Cumulative students. Seed with everyone who joined before the window so the
  // running total is accurate, then add each month's new signups.
  const signupsBucket: Record<string, number> = {}
  let baseStudents = 0
  latestStudentsData?.forEach((s) => {
    const date = new Date(s.created_at)
    if (date < windowStart) {
      baseStudents += 1
      return
    }
    const k = monthKeyOf(date)
    signupsBucket[k] = (signupsBucket[k] || 0) + 1
  })
  let cumulativeStudents = baseStudents
  const studentsData = window.map((b) => {
    cumulativeStudents += signupsBucket[b.key] || 0
    return { month: b.month, students: cumulativeStudents }
  })

  // Real period-over-period changes (this month vs last month) for the stat
  // cards, plus today-vs-yesterday for daily sales.
  const thisKey = window[window.length - 1].key
  const prevKey = window[window.length - 2].key
  const revThisMonth = revenueBucket[thisKey] || 0
  const revPrevMonth = revenueBucket[prevKey] || 0
  const stuThisMonth = signupsBucket[thisKey] || 0
  const stuPrevMonth = signupsBucket[prevKey] || 0

  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const salesYesterday = approvedPayments
    .filter((p) => new Date(p.created_at).toDateString() === yesterday)
    .reduce((s, p) => s + Number(p.amount), 0)
  const salesToday = approvedPayments
    .filter((p) => new Date(p.created_at).toDateString() === today)
    .reduce((s, p) => s + Number(p.amount), 0)

  const coursesThisMonth = (latestCoursesData || []).filter(
    (c) => monthKeyOf(c.created_at) === thisKey,
  ).length

  const changes = {
    revenue: percentChange(revThisMonth, revPrevMonth),
    students: percentChange(stuThisMonth, stuPrevMonth),
    sales: percentChange(salesToday, salesYesterday),
    coursesThisMonth,
  }

  // Top Courses
  const topCourses = (latestCoursesData || [])
    .sort((a, b) => (b.students || 0) - (a.students || 0))
    .slice(0, 5)
    .map((c) => ({
      title: c.title,
      students: `${c.students} طالب`,
      revenue: `${Number(c.price?.replace(/\D/g, '') || 0) * (c.students || 0)} ج.م`,
      image: c.image || '/courses/python.png',
    }))

  // Latest Payments
  const latestPayments = (payments || []).slice(0, 5).map((p, i) => ({
    id: `#PAY-${String(1000 + i)}`,
    name: p.student_name,
    course: p.course,
    amount: `${p.amount} ج.م`,
    status: p.status === 'مقبول' ? 'ناجح' : p.status === 'قيد المراجعة' ? 'معلّق' : 'مرفوض',
  }))

  // Latest Students
  const latestStudents = (latestStudentsData || []).slice(0, 5).map((s) => ({
    name: s.name,
    email: s.email,
    time: 'مؤخراً',
  }))

  // Latest Courses
  const latestCourses = (latestCoursesData || []).slice(0, 3).map((c) => ({
    title: c.title,
    status: c.status,
    time: 'مؤخراً',
    image: c.image || '/courses/javascript.png',
  }))

  // Latest Messages (mocked lightly if db isn't populated with messages yet, or fetch real)
  const { data: messagesData } = await supabase
    .from('messages')
    .select('text, created_at, read, conversations(student_name)')
    .order('created_at', { ascending: false })
    .limit(5)

  const latestMessages = (messagesData || []).map((m: any) => ({
    name: m.conversations?.student_name || 'طالب غير معروف',
    text: m.text,
    time: 'مؤخراً',
    unread: !m.read,
  }))

  // ── Exam analytics ────────────────────────────────────────────────────────
  // pass_mark is stored as a percentage threshold per exam (defaults to 50).
  const passMarkByExam: Record<string, number> = {}
  ;(examsData || []).forEach((e) => {
    passMarkByExam[e.id] = Number(e.pass_mark) || 50
  })

  const submissions = submissionsData || []
  let passCount = 0
  let failCount = 0
  let scoreSum = 0
  let scoredSubs = 0
  // Percentage buckets for the score-distribution histogram.
  const dist = { '0-49': 0, '50-69': 0, '70-84': 0, '85-100': 0 }
  submissions.forEach((s) => {
    const total = Number(s.total) || 0
    if (total <= 0) return
    const pct = (Number(s.score) / total) * 100
    scoreSum += pct
    scoredSubs += 1
    const threshold = passMarkByExam[s.exam_id] ?? 50
    if (pct >= threshold) passCount += 1
    else failCount += 1
    if (pct < 50) dist['0-49'] += 1
    else if (pct < 70) dist['50-69'] += 1
    else if (pct < 85) dist['70-84'] += 1
    else dist['85-100'] += 1
  })

  const totalGraded = passCount + failCount
  const passRate = totalGraded > 0 ? Math.round((passCount / totalGraded) * 100) : 0
  const avgScorePct = scoredSubs > 0 ? Math.round(scoreSum / scoredSubs) : 0
  const pendingGrading = submissions.filter((s) => s.grading_status === 'pending').length

  // Top exams by participation, using the stored avg_score for each exam.
  const examScores = (examsData || [])
    .slice(0, 6)
    .map((e) => ({
      name: e.title?.length > 16 ? e.title.slice(0, 16) + '…' : e.title || 'امتحان',
      avg: Math.round(Number(e.avg_score) || 0),
    }))

  const passFailData = [
    { name: 'ناجح', key: 'pass', value: passCount },
    { name: 'راسب', key: 'fail', value: failCount },
  ]

  const scoreDistribution = [
    { range: '٤٩-٠٪', count: dist['0-49'] },
    { range: '٦٩-٥٠٪', count: dist['50-69'] },
    { range: '٨٤-٧٠٪', count: dist['70-84'] },
    { range: '١٠٠-٨٥٪', count: dist['85-100'] },
  ]

  // ── Payment analytics ─────────────────────────────────────────────────────
  const allPayments = payments || []
  const pendingPayments = allPayments.filter((p) => p.status === 'قيد المراجعة')
  const pendingPaymentsCount = pendingPayments.length
  const pendingPaymentsAmount = pendingPayments.reduce((s, p) => s + Number(p.amount), 0)

  // Payment-method split (only approved payments count toward money in).
  const methodBucket: Record<string, number> = {}
  approvedPayments.forEach((p) => {
    const m = p.method || 'غير محدد'
    methodBucket[m] = (methodBucket[m] || 0) + Number(p.amount)
  })
  const paymentMethods = Object.entries(methodBucket)
    .map(([method, value], i) => ({ method, value, fill: `var(--chart-${(i % 5) + 1})` }))
    .sort((a, b) => b.value - a.value)

  // Payment-status split (count of transactions).
  const statusBucket: Record<string, number> = {}
  allPayments.forEach((p) => {
    const st = p.status || 'غير محدد'
    statusBucket[st] = (statusBucket[st] || 0) + 1
  })
  const paymentStatus = [
    { name: 'مقبول', value: statusBucket['مقبول'] || 0 },
    { name: 'قيد المراجعة', value: statusBucket['قيد المراجعة'] || 0 },
    { name: 'مرفوض', value: statusBucket['مرفوض'] || 0 },
  ]

  return {
    examStats: {
      passRate,
      avgScorePct,
      pendingGrading,
      pendingPaymentsCount,
      pendingPaymentsAmount,
    },
    examScores,
    passFailData,
    scoreDistribution,
    paymentMethods,
    paymentStatus,
    success: true,
    stats: {
      totalRevenue,
      totalStudents: studentsCount || 0,
      totalCourses: coursesCount || 0,
      totalLessons: lessonsCount || 0,
      salesToday,
      changes,
    },
    revenueData,
    studentsData,
    topCourses,
    latestPayments,
    latestStudents,
    latestCourses,
    latestMessages,
  }
}
