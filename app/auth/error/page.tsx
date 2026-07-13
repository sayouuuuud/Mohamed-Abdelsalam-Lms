import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthErrorPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 dark:bg-ink-base">
      <div className="w-full max-w-md rounded-2xl border border-navy/10 bg-cream-deep/60 p-8 text-center dark:border-ink-line dark:bg-ink-raised">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-500/15 text-amber-600">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-navy dark:text-ink-fg">
          حصلت مشكلة في تسجيل الدخول
        </h1>
        <p className="mt-2 text-sm text-navy-soft dark:text-ink-dim">
          الرابط غير صالح أو انتهت صلاحيته. حاول تسجّل الدخول مرة تانية.
        </p>
        <Link
          href="/auth"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-navy px-6 text-sm font-bold text-cream transition-colors hover:bg-navy-deep dark:bg-violet-glow dark:text-white dark:hover:bg-violet-deep"
        >
          الرجوع لتسجيل الدخول
        </Link>
      </div>
    </main>
  )
}
