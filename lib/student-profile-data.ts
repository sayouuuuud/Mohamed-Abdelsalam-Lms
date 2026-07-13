import { studentRecords, type StudentRecord, type StudentStatus } from './students-data'

export type DeviceInfo = {
  browser: string
  os: string
  deviceType: string
  ip: string
  city: string
  country: string
  lastActive: string
  sessions: number
}

export type EnrolledCourse = {
  id: string
  name: string
  category: string
  progress: number
  lessonsDone: number
  lessonsTotal: number
  lastAccessed: string
  status: 'قيد التقدم' | 'مكتمل' | 'متوقف'
}

export type PaymentRecord = {
  id: string
  date: string
  item: string
  amount: number
  method: 'فيزا' | 'ماستركارد' | 'فودافون كاش' | 'تحويل بنكي'
  status: 'ناجح' | 'مسترد' | 'معلّق'
}

export type ExamGrade = {
  id: string
  name: string
  course: string
  score: number
  total: number
  date: string
  status: 'ناجح' | 'راسب'
}

export type AssignmentRecord = {
  id: string
  name: string
  course: string
  dueDate: string
  status: 'تم التسليم' | 'متأخر' | 'لم يسلّم'
  grade: number | null
}

export type StudentProfile = {
  student: StudentRecord
  studentDbId: string   // students.id (UUID) — for server actions
  device: DeviceInfo
  totalSpent: number
  courses: EnrolledCourse[]
  payments: PaymentRecord[]
  exams: ExamGrade[]
  assignments: AssignmentRecord[]
  progressTrend: Array<{ month: string; progress: number }>
  monthlySpend: Array<{ month: string; amount: number }>
  // Raw data for client-side filtering
  completedLessonDates: string[]   // ISO date strings of each completed lesson
  rawOrders: Array<{ date: string; amount: number }> // each approved order
  totalLessonsAll: number
  // Per-branch comparison for the student's academic year.
  skills: Array<{
    subject: string
    examAvg: number
    courseProgress: number
    score: number
    examCount: number
    courseCount: number
  }>
  stageTitle: string
  assignmentBreakdown: Array<{ label: string; value: number }>
  // Live presence — is the student online now and when were they last seen.
  presence: {
    isOnline: boolean
    lastSeenLabel: string
    lastSeenAt: string | null
  }
}

// deterministic pseudo-random based on a string seed
function makeRng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function range(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو']
const browsers = ['Chrome 126', 'Safari 17', 'Firefox 127', 'Edge 126']
const systems = ['Windows 11', 'macOS Sonoma', 'Android 14', 'iOS 17']
const devices = ['كمبيوتر مكتبي', 'لابتوب', 'هاتف محمول', 'تابلت']
const cities = ['القاهرة', 'الإسكندرية', 'الجيزة', 'المنصورة', 'أسيوط', 'طنطا']
const courseCatalog = [
  { name: 'مقدمة في البرمجة', category: 'برمجة' },
  { name: 'تطوير الويب المتقدم', category: 'تطوير ويب' },
  { name: 'قواعد البيانات العلائقية', category: 'قواعد بيانات' },
  { name: 'مبادئ UI/UX', category: 'تصميم' },
  { name: 'هياكل البيانات', category: 'علوم حاسب' },
  { name: 'البرمجة بلغة بايثون', category: 'برمجة' },
  { name: 'مقدمة في الأمن السيبراني', category: 'أمن معلومات' },
  { name: 'مقدمة في تعلم الآلة', category: 'ذكاء اصطناعي' },
]
const examCatalog = [
  'اختبار أساسيات البرمجة',
  'امتحان نهاية الوحدة',
  'اختبار قواعد البيانات',
  'كويز تصميم الواجهات',
  'اختبار الخوارزميات',
  'كويز بايثون',
]
const assignmentCatalog = [
  'مشروع تطبيق ويب',
  'تمارين الوحدة الأولى',
  'تصميم قاعدة بيانات',
  'واجب الخوارزميات',
  'مشروع التخرج المصغّر',
  'تقرير تحليلي',
]

function parseSpent(spent: string): number {
  return Number(spent.replace(/[^\d]/g, '')) || 0
}

function buildProfile(student: StudentRecord): StudentProfile {
  const rng = makeRng(student.id)
  const totalSpent = parseSpent(student.spent)

  const courses: EnrolledCourse[] = Array.from({ length: student.courses }).map((_, i) => {
    const cat = courseCatalog[(i + range(rng, 0, 3)) % courseCatalog.length]
    const total = range(rng, 12, 40)
    const prog = i === 0 ? student.progress : range(rng, 10, 100)
    const done = Math.round((prog / 100) * total)
    return {
      id: `CRS-${student.id.replace('STD-', '')}-${i + 1}`,
      name: cat.name,
      category: cat.category,
      progress: prog,
      lessonsDone: done,
      lessonsTotal: total,
      lastAccessed: `${range(rng, 1, 28)} يونيو 2024`,
      status: prog >= 100 ? 'مكتمل' : prog < 20 ? 'متوقف' : 'قيد التقدم',
    }
  })

  const paymentCount = Math.max(student.courses, 2)
  const methods: PaymentRecord['method'][] = ['فيزا', 'ماستركارد', 'فودافون كاش', 'تحويل بنكي']
  const payments: PaymentRecord[] = Array.from({ length: paymentCount }).map((_, i) => {
    const amount = range(rng, 300, 900)
    return {
      id: `PAY-${student.id.replace('STD-', '')}${i + 1}`,
      date: `${range(rng, 1, 28)} ${pick(rng, months)} 2024`,
      item: courses[i % Math.max(courses.length, 1)]?.name ?? pick(rng, courseCatalog).name,
      amount,
      method: methods[i % methods.length],
      status: rng() > 0.85 ? 'مسترد' : rng() > 0.92 ? 'معلّق' : 'ناجح',
    }
  })

  const examCount = range(rng, 3, 6)
  const exams: ExamGrade[] = Array.from({ length: examCount }).map((_, i) => {
    const total = pick(rng, [20, 25, 30, 40])
    const ratio = (student.progress / 100) * 0.6 + rng() * 0.4
    const score = Math.min(total, Math.round(total * ratio))
    return {
      id: `EXM-${student.id.replace('STD-', '')}${i + 1}`,
      name: examCatalog[i % examCatalog.length],
      course: pick(rng, courseCatalog).name,
      score,
      total,
      date: `${range(rng, 1, 28)} ${pick(rng, months)} 2024`,
      status: score / total >= 0.5 ? 'ناجح' : 'راسب',
    }
  })

  const assignmentCount = range(rng, 4, 6)
  const statuses: AssignmentRecord['status'][] = ['تم التسليم', 'تم التسليم', 'متأخر', 'لم يسلّم']
  const assignments: AssignmentRecord[] = Array.from({ length: assignmentCount }).map((_, i) => {
    const st = statuses[range(rng, 0, statuses.length - 1)]
    return {
      id: `ASG-${student.id.replace('STD-', '')}${i + 1}`,
      name: assignmentCatalog[i % assignmentCatalog.length],
      course: pick(rng, courseCatalog).name,
      dueDate: `${range(rng, 1, 28)} ${pick(rng, months)} 2024`,
      status: st,
      grade: st === 'تم التسليم' ? range(rng, 60, 100) : st === 'متأخر' ? range(rng, 40, 80) : null,
    }
  })

  let running = Math.max(5, student.progress - range(rng, 30, 50))
  const progressTrend = months.map((month) => {
    running = Math.min(100, running + range(rng, 2, 14))
    return { month, progress: running }
  })
  // ensure final matches student.progress roughly
  progressTrend[progressTrend.length - 1].progress = student.progress

  const spendBase = Math.round(totalSpent / 6)
  const monthlySpend = months.map((month) => ({
    month,
    amount: Math.max(0, spendBase + range(rng, -spendBase, spendBase)),
  }))

  const skills = [
    { subject: 'الجبر والمتطابقات', examAvg: range(rng, 50, 100), courseProgress: range(rng, 40, 100) },
    { subject: 'التفاضل والتكامل', examAvg: range(rng, 45, 100), courseProgress: range(rng, 35, 95) },
    { subject: 'الميكانيكا', examAvg: range(rng, 40, 95), courseProgress: range(rng, 40, 95) },
  ].map((s) => ({
    ...s,
    score: Math.round((s.examAvg + s.courseProgress) / 2),
    examCount: range(rng, 1, 4),
    courseCount: range(rng, 1, 3),
  }))

  const submitted = assignments.filter((a) => a.status === 'تم التسليم').length
  const late = assignments.filter((a) => a.status === 'متأخر').length
  const missing = assignments.filter((a) => a.status === 'لم يسلّم').length
  const assignmentBreakdown = [
    { label: 'تم التسليم', value: submitted },
    { label: 'متأخر', value: late },
    { label: 'لم يسلّم', value: missing },
  ]

  const device: DeviceInfo = {
    browser: pick(rng, browsers),
    os: pick(rng, systems),
    deviceType: pick(rng, devices),
    ip: `${range(rng, 41, 197)}.${range(rng, 0, 255)}.${range(rng, 0, 255)}.${range(rng, 1, 254)}`,
    city: pick(rng, cities),
    country: 'مصر',
    lastActive: `منذ ${range(rng, 1, 12)} ساعة`,
    sessions: range(rng, 24, 320),
  }

  return {
    student,
    studentDbId: student.id,
    device,
    totalSpent,
    courses,
    payments,
    exams,
    assignments,
    progressTrend,
    monthlySpend,
    completedLessonDates: [],
    rawOrders: [],
    totalLessonsAll: 0,
    skills,
    stageTitle: 'الصف الثاني الثانوي',
    assignmentBreakdown,
    presence: {
      isOnline: rng() > 0.5,
      lastSeenLabel: `منذ ${range(rng, 1, 12)} ساعة`,
      lastSeenAt: null,
    },
  }
}

export function getStudentProfile(id: string): StudentProfile | null {
  const student = studentRecords.find((s) => s.id === id)
  if (!student) return null
  return buildProfile(student)
}

export function getAllStudentIds(): string[] {
  return studentRecords.map((s) => s.id)
}

export type { StudentRecord, StudentStatus }
