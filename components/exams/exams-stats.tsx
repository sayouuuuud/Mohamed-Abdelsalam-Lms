import { FileText, CheckCircle2, Users, Target, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ExamRecord } from '@/lib/exams-data'


export function ExamsStats({ exams = [] }: { exams?: ExamRecord[] }) {
  const totalExams = exams.length
  const publishedExams = exams.filter((e) => e.status === 'منشور').length
  const totalParticipants = exams.reduce((sum, e) => sum + (e.participants || 0), 0)
  const avgScore = totalExams > 0 
    ? Math.round(exams.reduce((sum, e) => sum + (e.avgScore || 0), 0) / totalExams) 
    : 0

  const computedStats = [
    {
      label: 'إجمالي الاختبارات',
      value: totalExams.toString(),
      change: '+1',
      sub: 'عن الشهر الماضي',
      icon: FileText,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'الاختبارات المنشورة',
      value: publishedExams.toString(),
      change: '+1',
      sub: 'عن الشهر الماضي',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'إجمالي المشاركات',
      value: totalParticipants.toLocaleString(),
      change: '+5',
      sub: 'عن الشهر الماضي',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'متوسط الدرجات',
      value: `${avgScore}%`,
      change: '+2%',
      sub: 'عن الشهر الماضي',
      icon: Target,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {computedStats.map((stat) => (
        <Card key={stat.label} className="gap-0 p-5 transition-shadow hover:shadow-md">
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
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                'flex items-center gap-0.5 font-semibold',
                stat.change.startsWith('-') ? 'text-rose-600' : 'text-emerald-600',
              )}
            >
              <TrendingUp
                className={cn('size-3.5', stat.change.startsWith('-') && 'rotate-180')}
              />
              {stat.change}
            </span>
            <span className="text-muted-foreground">{stat.sub}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
