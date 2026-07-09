export type StudentStatus = 'نشط' | 'موقوف'

export type StudentGender = 'ذكر' | 'أنثى'

export type StudentRecord = {
  id: string
  name: string
  email: string
  phone: string
  gender: StudentGender
  avatar?: string
  courses: number
  progress: number
  spent: string
  status: StudentStatus
  joinedAt: string
}

const maleAvatars = [
  'https://assets.watermelon.sh/wm_ben.png',
  'https://assets.watermelon.sh/wm_josh.png',
]

const femaleAvatars = [
  'https://assets.watermelon.sh/wm_olivia.png',
  'https://assets.watermelon.sh/wm_emma.png',
]

/**
 * يرجّع صورة الأفاتار الخاصة بالطالب.
 * لو الطالب رافع صورة بنفسه نستخدمها، وإلا نختار أفاتار حسب الجنس
 * (أفاتار ولد للذكر وأفاتار بنت للأنثى) بشكل ثابت لكل طالب.
 */
export function getStudentAvatar(student: {
  id?: string
  gender?: StudentGender
  avatar?: string
  avatarUrl?: string | null
}): string {
  if (student?.avatar) return student.avatar
  if (student?.avatarUrl) return student.avatarUrl
  const pool = student?.gender === 'أنثى' ? femaleAvatars : maleAvatars
  // Fall back to a stable seed when the student has no id yet (e.g. a freshly
  // registered user that doesn't have a `students` row).
  const seed = (student?.id ?? '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return pool[seed % pool.length]
}

export const studentRecords: StudentRecord[] = [
  {
    id: 'STD-1042',
    name: 'محمد إبراهيم',
    email: 'mohamed.ibrahim@email.com',
    phone: '0100 123 4567',
    gender: 'ذكر',
    courses: 5,
    progress: 82,
    spent: '2,450 ج.م',
    status: 'نشط',
    joinedAt: '12 يونيو 2024',
  },
  {
    id: 'STD-1041',
    name: 'فاطمة الزهراء',
    email: 'fatma.az@gmail.com',
    phone: '0111 987 6543',
    gender: 'أنثى',
    courses: 3,
    progress: 64,
    spent: '1,350 ج.م',
    status: 'نشط',
    joinedAt: '11 يونيو 2024',
  },
  {
    id: 'STD-1040',
    name: 'يوسف محمد',
    email: 'youssef.mohamed@email.com',
    phone: '0122 456 7890',
    gender: 'ذكر',
    courses: 2,
    progress: 38,
    spent: '900 ج.م',
    status: 'موقوف',
    joinedAt: '9 يونيو 2024',
  },
  {
    id: 'STD-1039',
    name: 'سارة محمود',
    email: 'sara.mahmoud@email.com',
    phone: '0109 321 6547',
    gender: 'أنثى',
    courses: 7,
    progress: 91,
    spent: '3,800 ج.م',
    status: 'نشط',
    joinedAt: '6 يونيو 2024',
  },
  {
    id: 'STD-1038',
    name: 'أحمد خالد',
    email: 'ahmed.khaled@email.com',
    phone: '0115 654 3210',
    gender: 'ذكر',
    courses: 1,
    progress: 12,
    spent: '450 ج.م',
    status: 'موقوف',
    joinedAt: '3 يونيو 2024',
  },
  {
    id: 'STD-1037',
    name: 'نورهان السيد',
    email: 'nourhan.elsayed@email.com',
    phone: '0128 741 9630',
    gender: 'أنثى',
    courses: 4,
    progress: 73,
    spent: '1,980 ج.م',
    status: 'نشط',
    joinedAt: '1 يونيو 2024',
  },
  {
    id: 'STD-1036',
    name: 'محمود علي',
    email: 'mahmoud.ali@email.com',
    phone: '0106 852 7413',
    gender: 'ذكر',
    courses: 2,
    progress: 45,
    spent: '750 ج.م',
    status: 'موقوف',
    joinedAt: '28 مايو 2024',
  },
  {
    id: 'STD-1035',
    name: 'مريم حسن',
    email: 'mariam.hassan@email.com',
    phone: '0114 369 2580',
    gender: 'أنثى',
    courses: 6,
    progress: 88,
    spent: '3,100 ج.م',
    status: 'نشط',
    joinedAt: '25 مايو 2024',
  },
  {
    id: 'STD-1034',
    name: 'عمر فاروق',
    email: 'omar.farouk@email.com',
    phone: '0127 159 7530',
    gender: 'ذكر',
    courses: 3,
    progress: 57,
    spent: '1,200 ج.م',
    status: 'نشط',
    joinedAt: '22 مايو 2024',
  },
  {
    id: 'STD-1033',
    name: 'ليلى عبد الله',
    email: 'laila.abdullah@email.com',
    phone: '0102 753 8520',
    gender: 'أنثى',
    courses: 1,
    progress: 8,
    spent: '300 ج.م',
    status: 'موقوف',
    joinedAt: '19 مايو 2024',
  },
]

export const statusFilters: Array<{ label: string; value: StudentStatus | 'الكل' }> = [
  { label: 'الكل', value: 'الكل' },
  { label: 'نشط', value: 'نشط' },
  { label: 'موقوف', value: 'موقوف' },
]
