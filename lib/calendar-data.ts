export type CalendarEventType = 'محاضرة' | 'اختبار' | 'موعد تسليم' | 'اجتماع' | 'حدث مخصص'

export type CalendarEvent = {
  id: string
  title: string
  /** التاريخ بصيغة yyyy-mm-dd */
  date: string
  /** وقت البداية بصيغة HH:mm */
  time: string
  type: CalendarEventType
  course?: string
  description?: string
  /** هل أنشأه المستخدم بنفسه */
  custom?: boolean
  stageId?: string | null
  branchId?: string | null
  lectureId?: string | null
}

export const eventTypes: CalendarEventType[] = [
  'محاضرة',
  'اختبار',
  'موعد تسليم',
  'اجتماع',
  'حدث مخصص',
]

/** ألوان كل نوع حدث (متوافقة مع الوضع الفاتح والداكن) */
export const eventTypeStyles: Record<
  CalendarEventType,
  { dot: string; chip: string; text: string; bar: string }
> = {
  محاضرة: {
    dot: 'bg-primary',
    chip: 'bg-primary/10 text-primary',
    text: 'text-primary',
    bar: 'border-r-primary',
  },
  اختبار: {
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'border-r-rose-500',
  },
  'موعد تسليم': {
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'border-r-amber-500',
  },
  اجتماع: {
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400',
    bar: 'border-r-blue-500',
  },
  'حدث مخصص': {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    bar: 'border-r-emerald-500',
  },
}

/** أسماء أيام الأسبوع (يبدأ من السبت) */
export const weekDays = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
]

export const monthNames = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

/** يحوّل تاريخ إلى صيغة yyyy-mm-dd بدون مشاكل التوقيت */
function toKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** يبني تاريخًا نسبيًا للشهر الحالي حتى تظهر الأحداث دائمًا */
function relativeDate(dayOffset: number) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  return toKey(d)
}

export const initialEvents: CalendarEvent[] = [
  {
    id: 'EVT-01',
    title: 'محاضرة مقدمة في البرمجة',
    date: relativeDate(0),
    time: '10:00',
    type: 'محاضرة',
    course: 'مقدمة في البرمجة',
    description: 'شرح المتغيرات وأنواع البيانات الأساسية',
  },
  {
    id: 'EVT-02',
    title: 'اختبار أساسيات قواعد البيانات',
    date: relativeDate(0),
    time: '14:00',
    type: 'اختبار',
    course: 'قواعد البيانات العلائقية',
    description: '30 سؤالًا - مدة 50 دقيقة',
  },
  {
    id: 'EVT-03',
    title: 'محاضرة تطوير الويب المتقدم',
    date: relativeDate(1),
    time: '12:00',
    type: 'محاضرة',
    course: 'تطوير الويب المتقدم',
  },
  {
    id: 'EVT-04',
    title: 'موعد تسليم مشروع UI/UX',
    date: relativeDate(2),
    time: '23:59',
    type: 'موعد تسليم',
    course: 'مبادئ UI/UX',
    description: 'تسليم النموذج الأولي عبر المنصة',
  },
  {
    id: 'EVT-05',
    title: 'اجتماع فريق المحتوى',
    date: relativeDate(3),
    time: '09:30',
    type: 'اجتماع',
    description: 'مراجعة خطة المحاضرات الجديدة',
  },
  {
    id: 'EVT-06',
    title: 'محاضرة هياكل البيانات',
    date: relativeDate(4),
    time: '11:00',
    type: 'محاضرة',
    course: 'هياكل البيانات',
  },
  {
    id: 'EVT-07',
    title: 'اختبار لغة بايثون',
    date: relativeDate(5),
    time: '13:00',
    type: 'اختبار',
    course: 'البرمجة بلغة بايثون',
    description: 'كويز قصير 20 سؤالًا',
  },
  {
    id: 'EVT-08',
    title: 'محاضرة الأمن السيبراني',
    date: relativeDate(7),
    time: '15:00',
    type: 'محاضرة',
    course: 'مقدمة في الأمن السيبراني',
  },
  {
    id: 'EVT-09',
    title: 'موعد تسليم واجب الشبكات',
    date: relativeDate(-2),
    time: '23:59',
    type: 'موعد تسليم',
    course: 'أساسيات الشبكات',
  },
  {
    id: 'EVT-10',
    title: 'محاضرة تعلم الآلة',
    date: relativeDate(9),
    time: '10:30',
    type: 'محاضرة',
    course: 'مقدمة في تعلم الآلة',
  },
]
