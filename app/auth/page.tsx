import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { AuthForm } from '@/components/auth/auth-form'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'تسجيل الدخول / حساب جديد | منصة عبد السلام للرياضيات',
  description:
    'سجّل دخولك أو اعمل حساب جديد على منصة الأستاذ عبد السلام للرياضيات للثانوية العامة.',
}

const perks = [
  'شرح مبسّط لكل درس خطوة بخطوة',
  'امتحانات بعد كل درس تثبّت المعلومة',
  'متابعة مستمرة لمستواك ودرجاتك',
]

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin' || profile?.role === 'assistant') {
      // Assistants land on the dashboard; middleware forwards them to their
      // first permitted page if they lack dashboard access.
      redirect('/admin/dashboard')
    } else {
      redirect('/student')
    }
  }

  const { mode } = await searchParams
  const initialTab = mode === 'register' ? 'register' : 'login'

  return (
    <main className="relative min-h-screen bg-cream lg:grid lg:grid-cols-2 dark:bg-ink-base">
      {/* graph paper backdrop */}
      <div className="graph-paper pointer-events-none absolute inset-0 opacity-60 dark:opacity-30" aria-hidden="true" />

      {/* Brand / visual panel */}
      <aside className="relative hidden overflow-hidden bg-navy lg:block dark:bg-ink-raised">
        <div className="graph-paper-light pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-md bg-cream font-mono text-sm font-bold text-navy">
              ƒ(x)
            </span>
            <span className="font-heading text-2xl font-bold text-cream">عبد السلام</span>
          </Link>

          <div className="max-w-md">
            <span className="text-sm font-semibold text-gold dark:text-teal-glow">
              <span className="font-mono">{'// '}</span>
              منصة الرياضيات الأولى للثانوية العامة
            </span>
            <h1 className="mt-4 text-balance font-heading text-4xl font-bold leading-tight text-cream">
              الرياضيات مش صعبة، هي بس محتاجة مُعلّم صح.
            </h1>
            <ul className="mt-8 space-y-4">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-3 text-cream/85">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-brand/20 text-emerald-brand">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-sm font-medium">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-6 text-cream/70">
            <Stat value="+48k" label="طالب وطالبة" />
            <span className="h-8 w-px bg-cream/15" />
            <Stat value="98%" label="نسبة رضا" />
            <span className="h-8 w-px bg-cream/15" />
            <Stat value="+25" label="سنة خبرة" />
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <section className="relative flex min-h-screen flex-col px-5 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-soft transition-colors hover:text-navy dark:text-ink-dim dark:hover:text-ink-fg"
          >
            <ArrowLeft className="size-4" />
            الرجوع للرئيسية
          </Link>
          {/* mobile-only logo */}
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-md bg-navy font-mono text-xs font-bold text-cream dark:bg-violet-glow dark:text-white">
              ƒ(x)
            </span>
            <span className="font-heading text-lg font-bold text-navy dark:text-ink-fg">عبد السلام</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <h2 className="text-balance text-2xl font-extrabold text-navy sm:text-3xl dark:text-ink-fg">
                أهلاً بيك من جديد
              </h2>
              <p className="mt-2 text-sm text-navy-soft dark:text-ink-dim">
                سجّل دخولك أو اعمل حساب جديد وابدأ رحلتك في التفوق.
              </p>
            </div>
            <AuthForm initialTab={initialTab} />
          </div>
        </div>
      </section>
    </main>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-xl font-black text-gold dark:text-teal-glow">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  )
}
