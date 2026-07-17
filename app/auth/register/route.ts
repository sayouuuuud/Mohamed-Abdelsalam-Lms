import { sendActivationCode } from '@/lib/email'
import {
  areRegistrationsAllowed,
  isEmailVerificationRequired,
} from '@/lib/settings-data'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

type Body = {
  email?: string
  password?: string
  full_name?: string
  phone?: string
  grade?: string
}

async function generateStudentCode(): Promise<string> {
  const lastStudent = await prisma.students.findFirst({
    orderBy: { code: 'desc' },
    select: { code: true }
  });

  let next = 1043
  if (lastStudent?.code) {
    const parsed = parseInt(String(lastStudent.code).replace(/[^0-9]/g, ''), 10)
    if (!Number.isNaN(parsed)) next = parsed + 1
  }
  return `STD-${next}`
}

async function resolveStageId(grade: string): Promise<string | null> {
  const slug = grade?.trim()
  if (!slug) return null
  const stage = await prisma.stages.findFirst({
    where: { slug },
    select: { id: true }
  })
  return stage?.id ?? null
}

async function ensureStudentRow(
  userId: string,
  email: string,
  metadata: { full_name: string; phone: string; grade: string },
) {
  const existing = await prisma.students.findFirst({
    where: { user_id: userId },
    select: { id: true, stage_id: true }
  })

  const stageId = await resolveStageId(metadata.grade)

  if (existing) {
    if (!existing.stage_id && stageId) {
      await prisma.students.update({
        where: { id: existing.id },
        data: { stage_id: stageId }
      })
    }
    return
  }

  const code = await generateStudentCode()
  await prisma.students.create({
    data: {
      code,
      user_id: userId,
      name: metadata.full_name || email.split('@')[0],
      email,
      phone: metadata.phone || null,
      stage_id: stageId,
    }
  })
}

export async function POST(request: NextRequest) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) {
    return NextResponse.json(
      { error: 'البريد الإلكتروني وكلمة السر مطلوبان.' },
      { status: 400 },
    )
  }

  if (!(await areRegistrationsAllowed())) {
    return NextResponse.json(
      { error: 'التسجيل مغلق حاليًا. تواصل مع إدارة المنصة.' },
      { status: 403 },
    )
  }

  const existingUser = await prisma.user.findFirst({
    where: { email }
  })

  if (existingUser) {
    return NextResponse.json(
      { error: 'البريد الإلكتروني مستخدم بالفعل.' },
      { status: 409 },
    )
  }

  const userMetadata = {
    full_name: body.full_name?.trim() ?? '',
    phone: body.phone?.trim() ?? '',
    grade: body.grade ?? '',
    role: 'student',
  }

  const verificationRequired = await isEmailVerificationRequired()
  
  // Create User
  const userId = crypto.randomUUID()
  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: {
      id: userId,
      email,
      encrypted_password: hashedPassword,
      aud: 'authenticated',
      role: 'authenticated',
      emailVerified: verificationRequired ? null : new Date(),
      created_at: new Date(),
      updated_at: new Date()
    }
  })

  await ensureStudentRow(userId, email, userMetadata)

  if (!verificationRequired) {
    return NextResponse.json({ ok: true, verified: true })
  }

  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // Clean up any old tokens
  await prisma.verificationToken.deleteMany({
    where: { identifier: email }
  })

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: code,
      expires: new Date(Date.now() + 10 * 60 * 1000)
    }
  })

  try {
    await sendActivationCode(email, code)
  } catch {
    return NextResponse.json(
      { error: 'تم إنشاء الحساب لكن فشل إرسال الكود. اضغط "ابعت كود تاني".' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, verified: false })
}
