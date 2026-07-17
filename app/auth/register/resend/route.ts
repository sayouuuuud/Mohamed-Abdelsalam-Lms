import { sendActivationCode } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  let email: string | undefined
  try {
    email = (await request.json())?.email?.trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json(
      { error: 'البريد الإلكتروني مطلوب.' },
      { status: 400 },
    )
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()

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
      { error: 'فشل إرسال الكود. حاول تاني.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
