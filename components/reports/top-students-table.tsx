import { Card } from '@/components/ui/card'
import { Medal } from 'lucide-react'

type TopStudent = { student_id: string; courses: number; name?: string }

const medalColors = ['text-amber-400', 'text-slate-400', 'text-amber-700']

export function TopStudentsTable({ students }: { students?: TopStudent[] }) {
  const data = students || []

  if (data.length === 0) {
    return (
      <Card className="flex h-full items-center justify-center p-10 text-center text-sm text-muted-foreground">
        لا توجد بيانات طلاب بعد.
      </Card>
    )
  }

  const max = data[0]?.courses || 1

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border p-5">
        <h3 className="text-base font-bold text-foreground">أكثر الطلاب نشاطاً</h3>
        <span className="text-xs text-muted-foreground">حسب عدد الكورسات</span>
      </div>
      <div className="divide-y divide-border">
        {data.map((s, i) => {
          const pct = Math.round((s.courses / max) * 100)
          return (
            <div key={s.student_id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex w-6 shrink-0 items-center justify-center">
                {i < 3 ? (
                  <Medal className={`size-4 ${medalColors[i]}`} />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {s.name || `طالب #${s.student_id.slice(-6)}`}
                </p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                {s.courses}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">كورس</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
