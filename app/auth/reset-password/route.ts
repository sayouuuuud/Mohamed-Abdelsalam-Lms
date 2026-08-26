import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  let body: { email?: string; code?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const code = body.code?.trim()
  const password = body.password

  if (!email || !code || !password) {
    return NextResponse.json(
      { error: 'البريد الإلكتروني، الكود، وكلمة المرور مطلوبة.' },
      { status: 400 },
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' },
      { status: 400 },
    )
  }

  const tokenRecord = await prisma.verificationToken.findFirst({
    where: {
      identifier: email,
      token: code,
    }
  })

  if (!tokenRecord) {
    return NextResponse.json(
      { error: 'الكود غير صحيح.' },
      { status: 400 },
    )
  }

  if (tokenRecord.expires < new Date()) {
    return NextResponse.json(
      { error: 'انتهت صلاحية الكود. اطلب كود جديد.' },
      { status: 400 },
    )
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  // Update user's password
  await prisma.user.updateMany({
    where: { email },
    data: { encrypted_password: hashedPassword }
  })

  // Delete the token
  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: email,
        token: code,
      }
    }
  })

  return NextResponse.json({ ok: true })
}
