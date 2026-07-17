'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import bcrypt from 'bcryptjs'
import type {
  StudentGender,
  StudentRecord,
  StudentStatus,
} from '@/lib/students-data'

export type StudentInput = {
  name: string
  email: string
  password?: string
  phone: string
  gender: StudentGender
  status: StudentStatus
  stageId?: string | null
}

export type StageOption = { id: string; title: string }

export async function getStages(): Promise<StageOption[]> {
  const data = await prisma.stages.findMany({
    select: { id: true, title: true, sort_order: true },
    orderBy: { sort_order: 'asc' }
  })
  return data.map((s) => ({ id: s.id, title: s.title }))
}

async function requireAdmin() {
  return hasResourceAccess('students', 'manage')
}

function formatJoinedAt(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return String(date)
  }
}

export async function getStudents(): Promise<StudentRecord[]> {
  const data = await prisma.students.findMany({
    select: { id: true, code: true, name: true, email: true, phone: true, gender: true, avatar: true, courses: true, progress: true, spent: true, status: true, joined_at: true },
    orderBy: { created_at: 'desc' }
  })

  return data.map((row) => ({
    id: row.code,
    name: row.name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    gender: row.gender as StudentGender,
    avatar: row.avatar ?? undefined,
    courses: row.courses ?? 0,
    progress: row.progress ?? 0,
    spent: row.spent ?? '0',
    status: row.status as StudentStatus,
    joinedAt: formatJoinedAt(row.joined_at),
  }))
}

export async function getStudentsStats() {
  if (!(await hasResourceAccess('students'))) {
    return null
  }

  const studentsRaw = await prisma.students.findMany({
    select: { id: true, status: true, created_at: true }
  })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const totalThis = studentsRaw.length
  const activeThis = studentsRaw.filter(s => s.status === 'نشط').length
  const suspendedThis = studentsRaw.filter(s => s.status === 'موقوف').length
  const newThis = studentsRaw.filter(s => new Date(s.created_at) >= thirtyDaysAgo).length

  const studentsPrevWindow = studentsRaw.filter(s => new Date(s.created_at) < thirtyDaysAgo)
  const totalPrev = studentsPrevWindow.length
  const activePrev = studentsPrevWindow.filter(s => s.status === 'نشط').length
  const suspendedPrev = studentsPrevWindow.filter(s => s.status === 'موقوف').length
  
  const newPrev = studentsRaw.filter(s => new Date(s.created_at) >= sixtyDaysAgo && new Date(s.created_at) < thirtyDaysAgo).length

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 1000) / 10
  }

  return {
    total: totalThis,
    totalChange: calcChange(totalThis, totalPrev),
    active: activeThis,
    activeChange: calcChange(activeThis, activePrev),
    new: newThis,
    newChange: calcChange(newThis, newPrev),
    suspended: suspendedThis,
    suspendedChange: calcChange(suspendedThis, suspendedPrev)
  }
}

async function generateStudentCode(): Promise<string> {
  const data = await prisma.students.findFirst({
    select: { code: true },
    orderBy: { code: 'desc' }
  })

  let next = 1043
  if (data?.code) {
    const parsed = parseInt(String(data.code).replace(/[^0-9]/g, ''), 10)
    if (!Number.isNaN(parsed)) next = parsed + 1
  }
  return `STD-${next}`
}

export async function createStudent(input: StudentInput) {
  if (!(await requireAdmin())) {
    return { error: 'غير مسموح. لازم تكون أدمن عشان تضيف طالب.' }
  }

  const code = await generateStudentCode()
  let userId: string | null = null

  if (input.email && input.password) {
    const existingUser = await prisma.user.findFirst({
      where: { email: input.email }
    })
    if (existingUser) {
      return { error: 'البريد الإلكتروني مستخدم بالفعل.' }
    }

    try {
      const hashedPassword = bcrypt.hashSync(input.password, 10)
      const newUserId = crypto.randomUUID()
      const user = await prisma.user.create({
        data: {
          id: newUserId,
          email: input.email,
          encrypted_password: hashedPassword,
          role: 'student',
          phone: input.phone,
        }
      })
      userId = user.id
      await prisma.profiles.create({
        data: {
          id: userId,
          full_name: input.name,
          email: input.email,
          phone: input.phone,
          role: 'student',
        }
      })
    } catch (authError: any) {
      console.log('[v0] createStudent auth error:', authError.message)
      return { error: 'تعذّر إنشاء حساب الطالب. حاول تاني.' }
    }
  }

  try {
    await prisma.students.create({
      data: {
        code,
        user_id: userId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        gender: input.gender,
        status: input.status,
        stage_id: input.stageId || null,
      }
    })

    logActivity({ action: 'create', resource: 'students', targetId: code, targetLabel: `طالب: ${input.name}` }).catch(() => {})
    revalidatePath('/students')
    return { success: true }
  } catch (error: any) {
    console.log('[v0] createStudent error:', error.message)
    return { error: 'تعذّر إضافة الطالب. تأكد من البيانات وحاول تاني.' }
  }
}

export async function deleteStudent(code: string) {
  if (!(await requireAdmin())) {
    return { error: 'غير مسموح. لازم تكون أدمن عشان تحذف طالب.' }
  }

  const row = await prisma.students.findUnique({
    where: { code },
    select: { user_id: true }
  })

  try {
    await prisma.students.delete({ where: { code } })
    
    if (row?.user_id) {
      await prisma.user.delete({ where: { id: row.user_id } }).catch((e: any) => {
        console.log('[v0] deleteStudent auth delete threw:', e.message)
      })
    }

    logActivity({ action: 'delete', resource: 'students', targetId: code, targetLabel: `طالب كود: ${code}` }).catch(() => {})
    revalidatePath('/students')
    return { success: true }
  } catch (error: any) {
    console.log('[v0] deleteStudent error:', error.message)
    return { error: 'تعذّر حذف الطالب.' }
  }
}
