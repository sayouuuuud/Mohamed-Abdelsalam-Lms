import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  let body: { email?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const code = body.code?.trim()

  if (!email || !code) {
    return NextResponse.json(
      { error: 'البريد الإلكتروني والكود مطلوبان.' },
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

  // Mark user as verified
  await prisma.user.updateMany({
    where: { email },
    data: { emailVerified: new Date() }
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
