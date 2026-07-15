import { createAdminClient } from '@/lib/supabase/admin'
import { sendActivationCode } from '@/lib/email'
import {
  areRegistrationsAllowed,
  isEmailVerificationRequired,
} from '@/lib/settings-data'
import { NextRequest, NextResponse } from 'next/server'

type Body = {
  email?: string
  password?: string
  full_name?: string
  phone?: string
  grade?: string
}

type AdminClient = ReturnType<typeof createAdminClient>

// Generates the next human-readable student code (e.g. STD-9111).
async function generateStudentCode(admin: AdminClient): Promise<string> {
  const { data } = await admin
    .from('students')
    .select('code')
    .order('code', { ascending: false })
    .limit(1)
    .maybeSingle()

  let next = 1043
  if (data?.code) {
    const parsed = parseInt(String(data.code).replace(/[^0-9]/g, ''), 10)
    if (!Number.isNaN(parsed)) next = parsed + 1
  }
  return `STD-${next}`
}

// Creates the matching row in `students` so self-registered users show up in
// the admin panel. The DB trigger only creates the `profiles` row, so without
// this a student who signs up never appears in the students list. Safe to call
// more than once — it no-ops if a row already exists for the user.
// Resolves the selected grade (which is the stage *slug*, e.g. "sec-2") into
// the matching stages.id. Without this the student's stage_id stays NULL and
// stage-targeted exams/announcements never appear for them.
async function resolveStageId(
  admin: AdminClient,
  grade: string,
): Promise<string | null> {
  const slug = grade?.trim()
  if (!slug) return null
  const { data } = await admin
    .from('stages')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  return data?.id ?? null
}

async function ensureStudentRow(
  admin: AdminClient,
  userId: string,
  email: string,
  metadata: { full_name: string; phone: string; grade: string },
) {
  const { data: existing } = await admin
    .from('students')
    .select('id, stage_id')
    .eq('user_id', userId)
    .maybeSingle()

  const stageId = await resolveStageId(admin, metadata.grade)

  if (existing) {
    // Backfill stage_id if the row exists but is missing its stage.
    if (!existing.stage_id && stageId) {
      await admin.from('students').update({ stage_id: stageId }).eq('id', existing.id)
    }
    return
  }

  const code = await generateStudentCode(admin)
  const { error } = await admin.from('students').insert({
    code,
    user_id: userId,
    name: metadata.full_name || email.split('@')[0],
    email,
    phone: metadata.phone || null,
    stage_id: stageId,
  })
  if (error) {
    console.log('[v0] ensureStudentRow error:', error.message)
  }
}

/**
 * Registration endpoint that creates the auth user and emails a 6-digit
 * activation code via our own SMTP (Gmail) — instead of relying on the
 * default Supabase confirmation email. The user is created UNCONFIRMED;
 * the client then calls supabase.auth.verifyOtp({ type: 'signup' }).
 */
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

  // Respect the admin's "allow registrations" switch.
  if (!(await areRegistrationsAllowed())) {
    return NextResponse.json(
      { error: 'التسجيل مغلق حاليًا. تواصل مع إدارة المنصة.' },
      { status: 403 },
    )
  }

  const supabase = createAdminClient()

  const userMetadata = {
    full_name: body.full_name?.trim() ?? '',
    phone: body.phone?.trim() ?? '',
    grade: body.grade ?? '',
    role: 'student',
  }

  // The admin can turn off email verification from the dashboard. When it's
  // off we create an already-confirmed user (no activation code needed); the
  // client logs in straight away.
  const verificationRequired = await isEmailVerificationRequired()

  if (!verificationRequired) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    })

    if (error) {
      const already =
        error.message.toLowerCase().includes('already') ||
        error.message.toLowerCase().includes('registered')
      return NextResponse.json(
        {
          error: already
            ? 'البريد الإلكتروني مستخدم بالفعل.'
            : 'حصلت مشكلة أثناء إنشاء الحساب. حاول تاني.',
        },
        { status: already ? 409 : 400 },
      )
    }

    // Make the student visible in the admin panel right away.
    if (created.user) {
      await ensureStudentRow(supabase, created.user.id, email, userMetadata)
    }

    // No verification step — the client can sign in immediately.
    return NextResponse.json({ ok: true, verified: true })
  }

  // generateLink with type 'signup' creates the (unconfirmed) user and returns
  // the email OTP we can deliver ourselves. The handle_new_user() trigger
  // populates the profile from user_metadata.
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      data: userMetadata,
    },
  })

  if (error) {
    const already =
      error.message.toLowerCase().includes('already') ||
      error.message.toLowerCase().includes('registered')
    return NextResponse.json(
      {
        error: already
          ? 'البريد الإلكتروني مستخدم بالفعل.'
          : 'حصلت مشكلة أثناء إنشاء الحساب. حاول تاني.',
      },
      { status: already ? 409 : 400 },
    )
  }

  // Create the students row now so the registration is visible to admins even
  // before the email is confirmed.
  if (data.user) {
    await ensureStudentRow(supabase, data.user.id, email, userMetadata)
  }

  const code = data.properties?.email_otp
  if (!code) {
    return NextResponse.json(
      { error: 'تعذّر توليد كود التفعيل. حاول تاني.' },
      { status: 500 },
    )
  }

  try {
    await sendActivationCode(email, code)
  } catch {
    // The user exists but the email failed — let them retry via "resend".
    return NextResponse.json(
      { error: 'تم إنشاء الحساب لكن فشل إرسال الكود. اضغط "ابعت كود تاني".' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, verified: false })
}
