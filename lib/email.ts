import 'server-only'
import nodemailer from 'nodemailer'

/**
 * Single shared SMTP transport built from SMTP_CONNECTION_URL
 * (e.g. smtps://user%40gmail.com:app-password@smtp.gmail.com:465).
 * Created lazily so a missing env var doesn't crash module import.
 */
let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  const url = process.env.SMTP_CONNECTION_URL
  if (!url) {
    throw new Error('SMTP_CONNECTION_URL غير مضبوط في البيئة.')
  }
  if (!transporter) {
    transporter = nodemailer.createTransport(url)
  }
  return transporter
}

/** عنوان المُرسِل: SMTP_FROM لو متوفّر، وإلا مستخدم الـ SMTP نفسه. */
function fromAddress() {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM
  try {
    const user = decodeURIComponent(
      new URL(process.env.SMTP_CONNECTION_URL!).username,
    )
    return `منصة عبد السلام <${user}>`
  } catch {
    return 'منصة عبد السلام'
  }
}

/** يبني قالب HTML عربي (RTL) لكود التفعيل. */
function activationEmailHtml(code: string) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;background:#f5f1e8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:16px;border:1px solid #e7e0d2;padding:32px;text-align:center;">
        <div style="font-family:monospace;font-size:18px;font-weight:bold;color:#13294b;">&fnof;(x) عبد السلام</div>
        <h1 style="font-size:20px;color:#13294b;margin:24px 0 8px;">فعّل حسابك</h1>
        <p style="font-size:14px;color:#5b6473;margin:0 0 24px;line-height:1.7;">
          أهلاً بيك في منصة الأستاذ عبد السلام للرياضيات!<br/>
          استخدم كود التفعيل ده عشان تفعّل حسابك:
        </p>
        <div style="display:inline-block;background:#13294b;color:#f5f1e8;font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:10px;padding:16px 28px;border-radius:12px;">
          ${code}
        </div>
        <p style="font-size:13px;color:#8a94a3;margin:24px 0 0;line-height:1.7;">
          اكتب الكود ده في صفحة التسجيل. الكود صالح لمدة ساعة واحدة.<br/>
          لو مش إنت اللي طلبت الحساب ده، تجاهل الرسالة.
        </p>
      </div>
      <p style="font-size:11px;color:#aab2bd;text-align:center;margin:16px 0 0;">
        منصة عبد السلام للرياضيات — الثانوية العامة
      </p>
    </div>
  </body>
</html>`
}

/** يبعت كود التفعيل لإيميل الطالب. يرمي خطأ لو فشل الإرسال. */
export async function sendActivationCode(to: string, code: string) {
  await getTransporter().sendMail({
    from: fromAddress(),
    to,
    subject: `كود تفعيل حسابك: ${code}`,
    html: activationEmailHtml(code),
    text: `كود تفعيل حسابك في منصة عبد السلام هو: ${code}\nالكود صالح لمدة ساعة.`,
  })
}

/** يبني قالب HTML عربي (RTL) لكود استعادة كلمة المرور. */
function resetPasswordEmailHtml(code: string) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;background:#f5f1e8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:16px;border:1px solid #e7e0d2;padding:32px;text-align:center;">
        <div style="font-family:monospace;font-size:18px;font-weight:bold;color:#13294b;">&fnof;(x) عبد السلام</div>
        <h1 style="font-size:20px;color:#13294b;margin:24px 0 8px;">استعادة كلمة المرور</h1>
        <p style="font-size:14px;color:#5b6473;margin:0 0 24px;line-height:1.7;">
          أهلاً بيك!<br/>
          تلقينا طلب لاستعادة كلمة المرور لحسابك. استخدم الكود ده:
        </p>
        <div style="display:inline-block;background:#13294b;color:#f5f1e8;font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:10px;padding:16px 28px;border-radius:12px;">
          ${code}
        </div>
        <p style="font-size:13px;color:#8a94a3;margin:24px 0 0;line-height:1.7;">
          اكتب الكود ده في صفحة استعادة كلمة المرور. الكود صالح لمدة ساعة واحدة.<br/>
          لو مش إنت اللي طلبت الكود ده، تجاهل الرسالة وتأكد إن حسابك آمن.
        </p>
      </div>
      <p style="font-size:11px;color:#aab2bd;text-align:center;margin:16px 0 0;">
        منصة عبد السلام للرياضيات — الثانوية العامة
      </p>
    </div>
  </body>
</html>`
}

/** يبعت كود استعادة كلمة المرور. */
export async function sendPasswordResetCode(to: string, code: string) {
  await getTransporter().sendMail({
    from: fromAddress(),
    to,
    subject: `كود استعادة كلمة المرور: ${code}`,
    html: resetPasswordEmailHtml(code),
    text: `كود استعادة كلمة المرور في منصة عبد السلام هو: ${code}\nالكود صالح لمدة ساعة.`,
  })
}
