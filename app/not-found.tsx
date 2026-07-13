import Link from 'next/link'
import { Home, ArrowRight } from 'lucide-react'
import { getCurriculum } from '@/lib/curriculum'

export default async function NotFound() {
  let stages: { id: string; title: string }[] = []
  try {
    const all = await getCurriculum()
    stages = all.map((s) => ({ id: s.id, title: s.title }))
  } catch {
    // نكمل بدون روابط ديناميكية لو الـ DB فشل
  }

  return (
    <main className="graph-paper min-h-screen bg-cream dark:bg-ink-base flex items-center justify-center px-5 py-20">
      <div className="w-full max-w-xl text-center">
        {/* رقم الخطأ */}
        <div className="font-mono text-8xl font-black text-navy/10 dark:text-ink-fg/5 select-none mb-2">
          404
        </div>

        {/* العنوان */}
        <h1 className="text-2xl font-bold text-navy dark:text-ink-fg mb-3">
          الصفحة دي مش موجودة
        </h1>

        <p className="text-navy/60 dark:text-ink-dim mb-8 leading-relaxed">
          يمكن الرابط اتكتب غلط أو الصفحة اتحذفت.
          <br />
          جرّب ترجع للرئيسية أو تختار مرحلة من تحت.
        </p>

        {/* روابط المراحل */}
        {stages.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {stages.map((stage) => (
              <Link
                key={stage.id}
                href={`/stages/${stage.id}`}
                className="rounded-xl border border-navy/15 dark:border-ink-line bg-cream-deep dark:bg-ink-raised px-5 py-2.5 text-sm font-semibold text-navy dark:text-ink-fg hover:bg-navy hover:text-cream dark:hover:bg-ink-line transition-colors"
              >
                {stage.title}
              </Link>
            ))}
          </div>
        )}

        {/* زر الرئيسية */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-gold text-navy font-bold px-6 py-3 hover:bg-gold-deep transition-colors"
        >
          <Home className="size-4" />
          <span>الرئيسية</span>
          <ArrowRight className="size-4 rotate-180" />
        </Link>
      </div>
    </main>
  )
}
