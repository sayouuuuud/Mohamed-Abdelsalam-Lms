'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { headers } from 'next/headers'

export async function getStudentProfile() {
  const session = await auth()
  const user = session?.user
  if (!user) return null

  const profile = await prisma.profiles.findUnique({
    where: { id: user.id },
    select: { full_name: true, email: true, phone: true, avatar_url: true, color_preset: true, notif_prefs: true, grade: true }
  })

  const student = await prisma.students.findFirst({
    where: { user_id: user.id },
    select: { id: true, code: true, name: true, phone: true, avatar: true, stage_id: true, status: true, joined_at: true, stages: { select: { title: true } } }
  })

  if (!profile && !student) return null

  const displayName = student?.name || profile?.full_name || ''
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const stageTitle = student?.stages?.title ?? profile?.grade ?? ''

  return {
    name: displayName,
    email: user.email ?? profile?.email ?? '',
    phone: student?.phone || profile?.phone || '',
    avatarUrl: student?.avatar || profile?.avatar_url || null,
    initials,
    level: stageTitle,
    stageTitle,
    status: student?.status ?? 'نشط',
    joinedAt: student?.joined_at ? student.joined_at.toISOString() : null,
    code: student?.code ?? '',
    colorPreset: profile?.color_preset ?? 'navy',
    notifPrefs: (profile?.notif_prefs as Record<string, boolean>) ?? {},
  }
}

export async function updateStudentProfile({
  fullName,
  phone,
  avatarUrl,
}: {
  fullName: string
  phone?: string
  avatarUrl?: string | null
}) {
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'يجب تسجيل الدخول.' }

  const trimmedName = fullName.trim()
  if (!trimmedName) return { error: 'الاسم مطلوب.' }

  const profilePatch: any = { full_name: trimmedName }
  if (phone !== undefined) profilePatch.phone = phone.trim()
  if (avatarUrl !== undefined && avatarUrl !== null) profilePatch.avatar_url = avatarUrl

  const studentPatch: any = { name: trimmedName }
  if (phone !== undefined) studentPatch.phone = phone.trim()
  if (avatarUrl !== undefined && avatarUrl !== null) studentPatch.avatar = avatarUrl

  await prisma.profiles.update({
    where: { id: user.id },
    data: profilePatch
  })

  await prisma.students.updateMany({
    where: { user_id: user.id },
    data: studentPatch
  })

  revalidatePath('/student')
  revalidatePath('/student/settings')
  return { success: true }
}

export async function updateStudentPreferences(
  colorPreset: string,
  notifPrefs: Record<string, boolean>,
) {
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'يجب تسجيل الدخول.' }

  await prisma.profiles.update({
    where: { id: user.id },
    data: { color_preset: colorPreset, notif_prefs: notifPrefs }
  })

  revalidatePath('/student/settings')
  return { success: true }
}

export async function setStudentGrade(grade: string) {
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'لازم تسجّل دخول.' }

  await prisma.profiles.update({
    where: { id: user.id },
    data: { grade }
  })

  revalidatePath('/student', 'layout')
  return { success: true }
}

export async function getAvailableStagesMinimal() {
  const stages = await prisma.stages.findMany({
    select: { id: true, slug: true, title: true },
    orderBy: { sort_order: 'asc' }
  })
  return stages
}

export async function trackStudentDevice() {
  const session = await auth()
  const user = session?.user
  if (!user) return

  const student = await prisma.students.findFirst({
    where: { user_id: user.id },
    select: { id: true }
  })
  if (!student) return

  const hdrs = await headers()
  const ip = hdrs.get('x-real-ip') || hdrs.get('x-forwarded-for') || '127.0.0.1'
  const city = hdrs.get('x-vercel-ip-city') || 'القاهرة'
  const country = hdrs.get('x-vercel-ip-country') || 'مصر'
  const ua = hdrs.get('user-agent') || ''

  let browser = 'Chrome'
  if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Edge')) browser = 'Edge'

  let os = 'Windows'
  if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS'

  let deviceType = 'كمبيوتر مكتبي'
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) deviceType = 'موبايل'
  else if (ua.includes('iPad') || ua.includes('Tablet')) deviceType = 'تابلت'

  const existing = await prisma.student_devices.findUnique({
    where: { student_id: student.id },
    select: { sessions: true }
  })
  const sessions = (existing?.sessions || 0) + 1

  await prisma.student_devices.upsert({
    where: { student_id: student.id },
    update: {
      ip, city, country, browser, os, device_type: deviceType,
      last_active: new Date(), sessions
    },
    create: {
      student_id: student.id,
      ip, city, country, browser, os, device_type: deviceType,
      last_active: new Date(), sessions
    }
  })

  const today = new Date()
  today.setHours(0,0,0,0)

  await prisma.learning_activity.upsert({
    where: {
      student_id_activity_date: {
        student_id: student.id,
        activity_date: today
      }
    },
    update: {},
    create: {
      student_id: student.id,
      activity_date: today,
      minutes: 0
    }
  })
}

import bcrypt from 'bcryptjs'

export async function updateStudentPassword(newPassword: string) {
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'يجب تسجيل الدخول.' }

  if (!newPassword || newPassword.length < 6) {
    return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id! },
    data: { encrypted_password: hashedPassword }
  })

  return { success: true }
}
