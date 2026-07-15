import Link from 'next/link'
import { Users, BookOpen, GraduationCap, ClipboardList, Layers } from 'lucide-react'
import type { GlobalSearchResults, SearchResultItem } from '@/app/admin/search/actions'

const TYPE_META = {
  student:  { label: 'الطلاب',      icon: Users },
  lecture:  { label: 'المحاضرات',   icon: BookOpen },
  course:   { label: 'الكورسات',    icon: GraduationCap },
  exam:     { label: 'الاختبارات',  icon: ClipboardList },
  category: { label: 'التصنيفات',   icon: Layers },
} as const

function Section({
  items,
  type,
}: {
  items: SearchResultItem[]
  type: keyof typeof TYPE_META
}) {
  if (items.length === 0) return null
  const { label, icon: Icon } = TYPE_META[type]

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </h2>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm transition-colors hover:bg-secondary/70"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10">
                <Icon className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.label}</p>
                {item.sublabel && (
                  <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SearchResults({
  q,
  results,
}: {
  q: string
  results: GlobalSearchResults
}) {
  const total =
    results.students.length +
    results.lectures.length +
    results.courses.length +
    results.exams.length +
    results.categories.length

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">
          نتائج البحث عن:{' '}
          <span className="text-primary">&ldquo;{q}&rdquo;</span>
        </h1>
        {total === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            لا توجد نتائج. جرّب كلمات أخرى.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {total} نتيجة
          </p>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-secondary">
            <ClipboardList className="size-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">لا توجد نتائج مطابقة.</p>
        </div>
      ) : (
        <div className="space-y-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Section items={results.students}  type="student"  />
          <Section items={results.lectures}  type="lecture"  />
          <Section items={results.courses}   type="course"   />
          <Section items={results.exams}     type="exam"     />
          <Section items={results.categories} type="category" />
        </div>
      )}
    </main>
  )
}
