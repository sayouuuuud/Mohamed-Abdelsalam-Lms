/**
 * lib/student-types.ts
 * مصدر الأنواع الوحيد لبوابة الطالب.
 * ملفات lib/student-*-data.ts تعمل re-export من هنا للأنواع فقط.
 */

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type StudentProfileInfo = {
  name: string
  email: string
  phone: string
  avatarUrl: string | null
  initials: string
  /** الكود مثل STD-1035 */
  code: string
  gender?: 'ذكر' | 'أنثى'
  stageTitle: string
  /** مرادف لـ stageTitle — مستخدم في بعض الـ components */
  level?: string
  status?: string
  joinedAt?: string | null
  colorPreset?: string
  notifPrefs?: Record<string, boolean>
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export type ActivityDay = {
  day: string
  isoDate: string
  hours: number
}



// ---------------------------------------------------------------------------
// Courses & Lessons
// ---------------------------------------------------------------------------

export type LessonType = 'فيديو' | 'مقال' | 'تمرين'

export type LessonAttachment = {
  name: string
  url: string
  type: 'pdf' | 'doc' | 'image' | 'other'
}

export type Lesson = {
  id: string
  /** UUID من قاعدة البيانات — يُستخدم لحفظ التقدّم */
  lessonId?: string
  title: string
  type: LessonType
  duration: string
  completed: boolean
  locked: boolean
  videoUrl?: string
  description?: string
  attachments?: LessonAttachment[]
}

export type CourseProgress = {
  id: string
  title: string
  instructor: string
  image: string
  category: string
  completedLessons: number
  totalLessons: number
  nextLesson: string
}

export type Section = {
  id: string
  title: string
  lessons: Lesson[]
  assignment?: Assignment
  items?: CourseItem[]
}

export type CourseDetail = CourseProgress & {
  description: string
  rating: number
  studentsCount: number
  durationHours: string
  level: string
  lastUpdated: string
  sections: Section[]
  whatYouLearn: string[]
}

export type CourseItem =
  | { kind: 'lesson'; lesson: Lesson; sectionId: string }
  | { kind: 'assignment'; assignment: Assignment; sectionId: string }

// ---------------------------------------------------------------------------
// Purchased monthly courses ("كورساتي")
// ---------------------------------------------------------------------------

/** محاضرة داخل كورس شهري اشترك فيه الطالب */
export type EnrolledCourseLecture = {
  /** slug — يُستخدم في الروابط */
  id: string
  dbId: string
  title: string
  image: string
  totalLessons: number
  completedLessons: number
  /** slug لأول درس غير مكتمل، أو أول درس عند اكتمال المحاضرة */
  nextLessonId: string | null
  /** أُضيفت للكورس بعد اشتراك الطالب */
  isNew: boolean
  /** تاريخ إضافة المحاضرة للكورس (ISO) */
  addedAt: string
  /** التصنيف اللي المحاضرة تابعة له داخل الكورس (null = بدون تصنيف) */
  sectionId: string | null
}

/** تصنيف داخل الكورس يجمّع مجموعة محاضرات (مثال: المراجعة النهائية) */
export type EnrolledCourseSection = {
  id: string
  title: string
}

/** كورس شهري اشترك فيه الطالب كباقة */
export type EnrolledMonthlyCourse = {
  /** slug للكورس */
  id: string
  /** UUID للكورس في قاعدة البيانات */
  dbId: string
  title: string
  description: string
  image: string
  branchTitle: string
  stageTitle: string
  /** تاريخ اشتراك الطالب (ISO) */
  enrolledAt: string
  totalLectures: number
  totalLessons: number
  completedLessons: number
  progressPercent: number
  /** عدد المحاضرات المضافة بعد الاشتراك ولم يفتحها الطالب بعد */
  newLecturesCount: number
  lectures: EnrolledCourseLecture[]
  /** تصنيفات الكورس مرتّبة (لتجميع المحاضرات في العرض) */
  sections: EnrolledCourseSection[]
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export type AssignmentStatus = 'لم يبدأ' | 'قيد التنفيذ' | 'تم التسليم' | 'مصحّح'
export type AssignmentType = 'تسليم' | 'اختبار'
export type QuestionKind = 'mcq' | 'essay' | 'file'

export type QuizQuestion = {
  id: string
  kind: QuestionKind
  question: string
  options: string[]
  correctIndex: number
}

export type Assignment = {
  id: string
  courseId: string
  sectionId?: string
  type: AssignmentType
  title: string
  description: string
  instructions: string[]
  dueDate: string
  points: number
  score?: number
  status: AssignmentStatus
  attachments: { name: string; size: string }[]
  questions?: QuizQuestion[]
  locked?: boolean
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

export type ExamStatus = 'متاح' | 'قادم' | 'مكتمل'

export type ExamQuestion = {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

export type Exam = {
  id: string
  title: string
  course: string
  courseId: string
  instructor: string
  category: string
  description: string
  instructions: string[]
  date: string
  time: string
  durationMinutes: number
  totalPoints: number
  passingPercent: number
  status: ExamStatus
  score?: number
  topics: string[]
  questions: ExamQuestion[]
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export type ScheduleEventType = 'محاضرة' | 'اختبار' | 'واجب' | 'مراجعة' | 'مباشر'

export type ScheduleEvent = {
  id: string
  title: string
  /** yyyy-mm-dd */
  date: string
  /** HH:mm */
  time: string
  type: ScheduleEventType
  course: string
  description?: string
}

/** مختصر للداشبورد */
export type ScheduleItem = {
  id: string
  title: string
  course: string
  type: 'محاضرة' | 'اختبار' | 'واجب' | 'مراجعة' | 'مباشر'
  day: string
  date: string
  time: string
}

export type GradeItem = {
  id: string
  title: string
  course: string
  score: number
  total: number
  date: string
}

export type Certificate = {
  id: string
  title: string
  issuer: string
  date: string
}

// ---------------------------------------------------------------------------
// Announcements (مشتقة من notifications في DB)
// ---------------------------------------------------------------------------

export type Announcement = {
  id: string
  title: string
  text: string
  time: string
  course: string
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Course content utilities (pure — no mock data dependency)
// ---------------------------------------------------------------------------

/** عناصر الوحدة مرتّبة: دروس وواجبات متداخلة كما رتّبها الأدمن */
export function getSectionItems(section: Section): CourseItem[] {
  if (section.items && section.items.length > 0) return section.items
  const items: CourseItem[] = section.lessons.map((lesson) => ({
    kind: 'lesson' as const,
    lesson,
    sectionId: section.id,
  }))
  if (section.assignment) {
    items.push({ kind: 'assignment', assignment: section.assignment, sectionId: section.id })
  }
  return items
}

/** تدفّق محتوى الكورس كاملاً عبر كل الوحدات */
export function getCourseItems(course: CourseDetail): CourseItem[] {
  return course.sections.flatMap((section) => getSectionItems(section))
}

/** جميع دروس الكورس مسطّحة */
export function getCourseLessons(course: CourseDetail): Lesson[] {
  return course.sections.flatMap((s) => s.lessons)
}

/** هل الواجب مفتوح؟ — يصبح مفتوحاً عندما تكتمل كل الدروس التي تسبقه */
export function isAssignmentUnlocked(course: CourseDetail, assignmentId: string): boolean {
  const items = getCourseItems(course)
  const index = items.findIndex(
    (it) => it.kind === 'assignment' && it.assignment.id === assignmentId,
  )
  if (index === -1) return true
  return items.slice(0, index).every((it) => it.kind !== 'lesson' || it.lesson.completed)
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export type InvoiceStatus = 'غير مدفوعة' | 'قيد المراجعة' | 'مدفوعة' | 'مرفوضة'
export type PaymentMethod = 'انستاباي' | 'فودافون كاش'

export type Invoice = {
  id: string
  course: string
  instructor: string
  amount: number
  issuedAt: string
  dueDate: string
  status: InvoiceStatus
  method?: PaymentMethod
  reference?: string
  senderInfo?: string
  submittedAt?: string
  rejectionReason?: string
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type ChatMessage = {
  id: string
  fromMe: boolean
  text: string
  time: string
}

export type TicketStatus = 'open' | 'closed'

export type Conversation = {
  id: string
  name: string
  role: string
  initials: string
  avatar?: string
  subject: string
  status: TicketStatus
  lastTime: string
  unread: number
  messages: ChatMessage[]
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'lesson'
  | 'exam'
  | 'assignment'
  | 'grade'
  | 'message'
  | 'certificate'
  | 'system'

export type Notification = {
  id: string
  type: NotificationType
  title: string
  text: string
  time: string
  read: boolean
}

// ---------------------------------------------------------------------------
// StudentData (Context)
// ---------------------------------------------------------------------------

export type StudentData = {
  profile: StudentProfileInfo
  enrolledCourses: CourseProgress[]
  schedule: ScheduleItem[]
  grades: GradeItem[]
  announcements: Announcement[]
  activity: ActivityDay[]
  notifications: Notification[]
}
