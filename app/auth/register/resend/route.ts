import { createAdminClient } from '@/lib/supabase/admin'
import { sendActivationCode } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Re-sends a fresh 6-digit activation code to an already-registered but
 * unconfirmed user, delivered via our own SMTP. Uses generateLink without a
 * password (the user already exists) which mints a new OTP each call.
 */
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

  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
  } as any)

  const code = data?.properties?.email_otp
  if (error || !code) {
    return NextResponse.json(
      { error: 'مقدرناش نبعت الكود تاني دلوقتي. حاول مرة كمان.' },
      { status: 400 },
    )
  }

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
