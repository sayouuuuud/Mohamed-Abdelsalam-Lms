import { BookOpen, CheckCircle2, FileCheck2, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CourseProgress, GradeItem, ActivityDay } from '@/lib/student-types'

export function StudentStats({
  courses = [],
  grades = [],
  activity = [],
}: {
  courses?: CourseProgress[]
  grades?: GradeItem[]
  activity?: ActivityDay[]
}) {
  const totalCompletedLessons = courses.reduce((s, c) => s + c.completedLessons, 0)
  const totalLessons = courses.reduce((s, c) => s + c.totalLessons, 0)

  // Total learning hours this week (last 7 days from activity).
  const weekHours = parseFloat(
    activity.reduce((s, d) => s + d.hours, 0).toFixed(1),
  )

  const stats = [
    {
      label: 'المحاضرات المسجّلة',
      value: String(courses.length),
      sub: courses.length === 1 ? 'كورس نشط' : 'كورسات نشطة',
      icon: BookOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'الدروس المكتملة',
      value: String(totalCompletedLessons),
      sub: totalLessons > 0 ? `من ${totalLessons} درس` : 'درس مكتمل',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'الدرجات المصحّحة',
      value: String(grades.length),
      sub: grades.length === 1 ? 'درجة مسجّلة' : 'درجات مسجّلة',
      icon: FileCheck2,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
    {
      label: 'ساعات التعلّم',
      value: String(weekHours),
      sub: 'هذا الأسبوع',
      icon: Clock,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="gap-0 p-4 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-xl',
                stat.bg,
              )}
            >
              <stat.icon className={cn('size-5', stat.color)} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{stat.value}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{stat.sub}</p>
        </Card>
      ))}
    </div>
  )
}
