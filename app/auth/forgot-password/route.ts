import { sendPasswordResetCode } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json(
      { error: 'البريد الإلكتروني مطلوب.' },
      { status: 400 },
    )
  }

  const user = await prisma.user.findFirst({
    where: { email }
  })

  // We always return success to prevent email enumeration, but we only send email if user exists.
  if (user) {
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    await prisma.verificationToken.deleteMany({
      where: { identifier: email }
    })

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: code,
        expires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      }
    })

    try {
      await sendPasswordResetCode(email, code)
    } catch {
      return NextResponse.json(
        { error: 'حدث مشكلة أثناء إرسال الكود. حاول مرة أخرى.' },
        { status: 502 },
      )
    }
  }

  return NextResponse.json({ ok: true })
}
