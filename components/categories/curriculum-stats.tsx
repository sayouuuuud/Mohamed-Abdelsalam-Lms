'use client'

import { Layers, GitBranch, BookOpen, GraduationCap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useCurriculum } from './curriculum-context'

export function CurriculumStats() {
  const { stages } = useCurriculum()

  const totalStages = stages.length
  const totalBranches = stages.reduce((sum, s) => sum + s.branches.length, 0)
  const totalLectures = stages.reduce(
    (sum, s) => sum + s.branches.reduce((b, br) => b + br.lectureCount, 0),
    0,
  )
  const totalCourses = stages.reduce(
    (sum, s) => sum + s.branches.reduce((b, br) => b + br.courses.length, 0),
    0,
  )


  const stats = [
    {
      label: 'التصنيفات الرئيسية',
      value: totalStages.toLocaleString('en-US'),
      icon: Layers,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'التصنيفات الفرعية',
      value: totalBranches.toLocaleString('en-US'),
      icon: GitBranch,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'إجمالي الكورسات',
      value: totalCourses.toLocaleString('en-US'),
      icon: GraduationCap,
      color: 'text-sky-600',
      bg: 'bg-sky-50 dark:bg-sky-500/10',
    },
    {
      label: 'إجمالي المحاضرات',
      value: totalLectures.toLocaleString('en-US'),
      icon: BookOpen,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },

  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
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
        </Card>
      ))}
    </div>
  )
}
