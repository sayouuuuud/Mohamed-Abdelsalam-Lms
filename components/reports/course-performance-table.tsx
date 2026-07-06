import { Card } from '@/components/ui/card'
import { coursePerformance as initialData } from '@/lib/reports-data'

function ShareBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{value}%</span>
    </div>
  )
}

export function CoursePerformanceTable({ courses: inputCourses }: { courses?: any[] }) {
  const coursePerformance = inputCourses || initialData

  if (coursePerformance.length === 0) {
    return (
      <Card className="flex h-full items-center justify-center p-10 text-center text-sm text-muted-foreground">
        لا توجد بيانات كورسات بعد.
      </Card>
    )
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border p-5">
        <h3 className="text-base font-bold text-foreground">أداء المحاضرات</h3>
        <span className="text-xs font-medium text-muted-foreground">
          الأعلى تحقيقًا للإيراد
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden max-h-[300px] overflow-auto md:block">
        <table className="w-full text-right text-sm relative">
          <thead className="sticky top-0 bg-card z-10 shadow-sm">
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">الكورس</th>
              <th className="px-5 py-3 font-medium">التصنيف</th>
              <th className="px-5 py-3 font-medium">الطلاب</th>
              <th className="px-5 py-3 font-medium">الإيرادات</th>
              <th className="px-5 py-3 font-medium">حصة الإيراد</th>
            </tr>
          </thead>
          <tbody>
            {coursePerformance.map((c) => (
              <tr key={c.title} className="border-b border-border last:border-0 hover:bg-secondary/40">
                <td className="px-5 py-4 font-semibold text-foreground">{c.title}</td>
                <td className="px-5 py-4 text-muted-foreground">{c.category}</td>
                <td className="px-5 py-4 text-foreground">{c.students.toLocaleString('en-US')}</td>
                <td className="px-5 py-4 font-semibold text-foreground">
                  {c.revenue.toLocaleString('en-US')} ج.م
                </td>
                <td className="px-5 py-4">
                  <ShareBar value={c.share} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border md:hidden max-h-[350px] overflow-y-auto">
        {coursePerformance.map((c) => (
          <div key={c.title} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{c.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.category}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {c.revenue.toLocaleString('en-US')} ج.م
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{c.students.toLocaleString('en-US')} طالب</span>
            </div>
            <ShareBar value={c.share} />
          </div>
        ))}
      </div>
    </Card>
  )
}
