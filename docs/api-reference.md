# API Reference — Types, Server Actions & State

> **ملاحظة:** كل البيانات الوهمية القديمة (`@deprecated`) موجودة في
> `lib/student-data.ts` و `lib/student-courses-data.ts` كـ stub فارغة.
> المصدر الحقيقي الوحيد الآن هو الـ Server Actions أدناه.

---

## 1. TypeScript Types (`lib/student-types.ts`)

### Profile

```ts
type StudentProfileInfo = {
  name: string
  email: string
  phone: string
  avatarUrl: string | null
  initials: string
  code: string                          // مثال: STD-1035
  gender?: 'ذكر' | 'أنثى'
  stageTitle: string
  level?: string
  status?: string
  joinedAt?: string | null
  colorPreset?: string
  notifPrefs?: Record<string, boolean>
}
```

### Activity

```ts
type ActivityDay = { day: string; hours: number }
```

### Courses & Lessons

```ts
type LessonType = 'فيديو' | 'مقال' | 'تمرين'

type Lesson = {
  id: string
  lessonId?: string       // UUID من DB — لحفظ التقدّم
  title: string
  type: LessonType
  duration: string
  completed: boolean
  locked: boolean
  videoUrl?: string       // دائمًا undefined للعميل — يُستبدل بـ signed proxy URL
  description?: string
}

type CourseProgress = {
  id: string; title: string; instructor: string; image: string
  category: string; completedLessons: number; totalLessons: number; nextLesson: string
}

type Section = {
  id: string; title: string; lessons: Lesson[]
  assignment?: Assignment; items?: CourseItem[]
}

type CourseDetail = CourseProgress & {
  description: string; rating: number; studentsCount: number
  durationHours: number; level: string; lastUpdated: string
  sections: Section[]; whatYouLearn: string[]
}

type CourseItem =
  | { kind: 'lesson';      lesson: Lesson;         sectionId: string }
  | { kind: 'assignment';  assignment: Assignment;  sectionId: string }
```

### Assignments

```ts
type AssignmentStatus = 'لم يبدأ' | 'قيد التنفيذ' | 'تم التسليم' | 'مصحّح'
type AssignmentType   = 'تسليم' | 'اختبار'
type QuestionKind     = 'mcq' | 'essay' | 'file'

type QuizQuestion = {
  id: string; kind: QuestionKind; question: string
  options: string[]; correctIndex: number
}

type Assignment = {
  id: string; courseId: string; sectionId?: string
  type: AssignmentType; title: string; description: string
  instructions: string[]; dueDate: string; points: number
  score?: number; status: AssignmentStatus
  attachments: { name: string; size: string }[]
  questions?: QuizQuestion[]
  locked?: boolean
}
```

### Exams

```ts
type ExamStatus = 'متاح' | 'قادم' | 'مكتمل'

type ExamQuestion = {
  id: string; question: string; options: string[]; correctIndex: number
}

type Exam = {
  id: string; title: string; course: string; courseId: string
  instructor: string; category: string; description: string
  instructions: string[]; date: string; time: string
  durationMinutes: number; totalPoints: number; passingPercent: number
  status: ExamStatus; score?: number; topics: string[]; questions: ExamQuestion[]
}
```

### Schedule

```ts
type ScheduleEventType = 'محاضرة' | 'اختبار' | 'واجب' | 'مراجعة' | 'مباشر'

type ScheduleEvent = {
  id: string; title: string
  date: string   // yyyy-mm-dd
  time: string   // HH:mm
  type: ScheduleEventType; course: string; description?: string
}

type ScheduleItem = {          // مختصر للداشبورد
  id: string; title: string; course: string
  type: 'محاضرة' | 'اختبار' | 'واجب' | 'مراجعة'
  day: string; date: string; time: string
}
```

### Grades & Certificates

```ts
type GradeItem = {
  id: string; title: string; course: string
  score: number; total: number; date: string
}

type Certificate = { id: string; title: string; issuer: string; date: string }
```

### Billing

```ts
type InvoiceStatus  = 'غير مدفوعة' | 'قيد المراجعة' | 'مدفوعة' | 'مرفوضة'
type PaymentMethod  = 'انستاباي' | 'فودافون كاش'

type Invoice = {
  id: string; course: string; instructor: string
  amount: number; issuedAt: string; dueDate: string
  status: InvoiceStatus; method?: PaymentMethod
  reference?: string; senderInfo?: string
  submittedAt?: string; rejectionReason?: string
}
```

### Notifications & Messages

```ts
type NotificationType =
  'lesson' | 'exam' | 'assignment' | 'grade' | 'message' | 'certificate' | 'system'

type Notification = {
  id: string; type: NotificationType; title: string
  text: string; time: string; read: boolean
}

type ChatMessage = { id: string; fromMe: boolean; text: string; time: string }
type TicketStatus = 'open' | 'closed'

type Conversation = {
  id: string; name: string; role: string; initials: string
  avatar?: string; subject: string; status: TicketStatus
  lastTime: string; unread: number; messages: ChatMessage[]
}
```

### Announcements

```ts
type Announcement = { id: string; title: string; text: string; time: string; course: string }
```

### StudentData (Context)

```ts
type StudentData = {
  profile: StudentProfileInfo
  enrolledCourses: CourseProgress[]
  schedule: ScheduleItem[]
  grades: GradeItem[]
  announcements: Announcement[]
  activity: ActivityDay[]
  notifications: Notification[]
}
```

### Internal DB Row Types (server-only)

```ts
// lib/student-lectures-data.ts
type LectureRow = {
  id: string; slug: string; title: string; description: string | null
  image?: string | null; instructor?: string | null; studentsCount?: number
  branches: { title: string | null; image: string | null; stages: { title: string | null } | null } | null
  lessons: { id: string; slug: string; title: string; duration: string | null; is_free: boolean; sort_order: number | null; video_url: string | null; description: string | null; content_type: string | null }[]
  assignments?: AssignmentRow[]
}

type AssignmentRow = {
  id: string; code: string; type: string | null; title: string
  description: string | null; instructions: string[] | null; points: number | null
  sort_order?: number | null
  assignment_questions: { id: string; kind: string | null; question: string; options: string[]; correct_index: number; position: number | null }[]
}

type Progress = {
  completedLessonIds: Set<string>
  assignmentStatus: Map<string, { status: AssignmentStatus; score: number | null }>
}

// app/student/actions.ts
type OrderRow = {
  code: string; method: string | null; reference: string | null
  note: string | null; total: number; status: string; created_at: string
  order_items: { lecture_title: string | null }[] | null
}

type MonthlyStat = {
  label: string; value: string | number; change: string; positive: boolean | null
}
```

---

## 2. Server Actions

### بوابة الطالب (`app/student/actions.ts`)

| الدالة | الجدول(ـات) | الإرجاع |
|--------|-------------|---------|
| `getStudentInvoices()` | `orders`, `order_items` | `Invoice[]` |
| `resubmitPayment(code, method, reference)` | `orders` | `{ success } \| { error }` |
| `getStudentEnrolledCourses()` | عبر `getPurchasedCourses()` | `CourseProgress[]` |
| `getStudentUpcomingSchedule()` | `calendar_events` | `ScheduleItem[]` (أقرب 5) |
| `getStudentFullSchedule()` | `calendar_events` | `ScheduleEvent[]` |
| `getStudentRecentGrades()` | `assignment_submissions`, `exam_submissions` | `GradeItem[]` (أحدث 5) |
| `getStudentCertificates()` | `certificates` | `Certificate[]` |
| `getStudentAnnouncements()` | `notifications` | `Announcement[]` (أحدث 5) |
| `getStudentNotifications()` | `notifications`, `notification_reads` | `Notification[]` |
| `markStudentNotificationRead(notifId)` | `notification_reads` | `{ success } \| { error }` |
| `markAllStudentNotificationsRead(notifIds[])` | `notification_reads` | `{ success } \| { error }` |
| `getStudentExams()` | `exams`, `exam_submissions` | `Exam[]` |
| `getStudentAssignments()` | `assignments`, `assignment_submissions` | `Assignment[]` |
| `getStudentLearningActivity()` | `learning_activity` | `ActivityDay[]` (آخر 7 أيام) |
| `getStudentMonthlyProgress()` | `student_content_progress`, `learning_activity`, `assignment_submissions`, `exam_submissions` | `MonthlyStat[]` (4 عناصر) |
| `getStudentProfile()` | `profiles`, `students`, `stages` | `StudentProfileInfo \| null` |
| `updateStudentProfile({ fullName, phone?, avatarUrl? })` | `profiles`, `students` | `{ success } \| { error }` |
| `updateStudentPreferences(colorPreset, notifPrefs)` | `profiles` | `{ success } \| { error }` |
| `getAvailableStagesMinimal()` | `stages` | `{ id, slug, title }[]` |
| `setStudentGrade(grade)` | `profiles` | `{ success } \| { error }` |
| `trackStudentDevice()` | `student_devices` | `void` |

### إدارة المحاضرات (`lib/student-lectures-data.ts`)

| الدالة | الوصف |
|--------|-------|
| `getPurchasedCourses()` | جميع المحاضرات المشتراة كـ `CourseDetail[]` |
| `getPurchasedCourseDetail(slug)` | كورس واحد بالـ slug — `CourseDetail \| undefined` |
| `getPurchasedAssignment(assignmentId)` | واجب واحد مع التحقق من ملكية الطالب |
| `getPurchasedLesson(courseSlug, lessonSlug)` | درس واحد مع توكن فيديو موقّع — يدوّر الجلسة |

### لوحة الأدمن (`app/admin/dashboard/actions.ts`)

```ts
getDashboardData() → {
  stats: {
    totalRevenue: number
    totalStudents: number
    totalCourses: number
    totalLessons: number
    salesToday: number
    changes: {
      revenue: number        // % تغيير عن الشهر السابق
      students: number
      sales: number
      coursesThisMonth: number
    }
  }
  revenueData: { month: string; revenue: number }[]     // آخر 12 شهر
  studentsData: { month: string; students: number }[]   // تراكمي
  topCourses:    { title: string; students: string; revenue: string; image: string }[]
  latestPayments: { id: string; name: string; course: string; amount: string; status: string }[]
  latestStudents: { name: string; email: string; time: string }[]
  latestCourses:  { title: string; status: string; time: string; image: string }[]
  latestMessages: { name: string; text: string; time: string; unread: boolean }[]
}
```

---

## 3. State — Deprecated Stubs (لا تُستخدم)

> هذه المتغيّرات في `lib/student-data.ts` و `lib/student-courses-data.ts`
> موجودة فقط للتوافق مع الاستيرادات القديمة — قيمها فارغة دائمًا.

```ts
// lib/student-data.ts
const studentProfile  = null          // @deprecated → getStudentProfile()
const enrolledCourses = []            // @deprecated → getStudentEnrolledCourses()
const recentGrades    = []            // @deprecated → getStudentRecentGrades()
const announcements   = []            // @deprecated → getStudentAnnouncements()
const learningActivity = []           // @deprecated → getStudentLearningActivity()

// lib/student-courses-data.ts
const courseDetails = []              // @deprecated → getPurchasedCourses()
const assignments   = []              // @deprecated → getStudentAssignments()
function getCourseDetail(_id) { return undefined }   // @deprecated
function getAssignment(_id)   { return undefined }   // @deprecated
```

---

## 4. Utility Functions (`lib/student-types.ts`)

```ts
// يرتّب عناصر الوحدة (دروس + واجبات) بالترتيب الذي ضبطه الأدمن
getSectionItems(section: Section): CourseItem[]

// تدفّق المحتوى كاملاً عبر كل الوحدات
getCourseItems(course: CourseDetail): CourseItem[]

// جميع الدروس مسطّحة
getCourseLessons(course: CourseDetail): Lesson[]

// الواجب يُفتح فقط بعد إكمال كل الدروس التي تسبقه
isAssignmentUnlocked(course: CourseDetail, assignmentId: string): boolean
```

---

## 5. Supabase Tables المستخدمة

| الجدول | الغرض |
|--------|-------|
| `profiles` | إعدادات المستخدم (اسم، هاتف، صورة، درجة، تفضيلات) |
| `students` | بيانات الطالب (كود، مرحلة، حالة) |
| `stages` / `branches` | التصنيف الدراسي |
| `lectures` / `lessons` | المحاضرات والدروس |
| `assignments` / `assignment_questions` | الواجبات وأسئلتها |
| `assignment_submissions` | تسليمات الواجبات + الدرجات |
| `exams` / `exam_submissions` | الاختبارات وتسليماتها |
| `orders` / `order_items` | الطلبات الشرائية (مصدر الفواتير) |
| `enrollments` | اشتراكات الطالب في المحاضرات |
| `calendar_events` | الجدول الدراسي |
| `notifications` / `notification_reads` | الإشعارات وحالة القراءة |
| `learning_activity` | تتبّع ساعات التعلّم اليومية |
| `student_content_progress` | تقدّم الدروس والواجبات |
| `student_devices` | تتبّع أجهزة الطالب |
| `certificates` | شهادات الإتمام |
| `lecture_playback_sessions` | جلسات تشغيل الفيديو (أمان) |
