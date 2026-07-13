'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCurriculum } from '@/components/categories/curriculum-context'
import { LecturesStats } from './lectures-stats'
import { LecturesGrid } from './lectures-grid'
import { CoursesGrid } from '@/components/categories/courses-grid'

export function CoursesLecturesTabs() {
  const [tab, setTab] = useState<'lectures' | 'courses'>('lectures')
  const { openCreateCourse } = useCurriculum()

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex w-fit items-center gap-1 rounded-xl border border-border bg-secondary/50 p-1"
          role="tablist"
          aria-label="عرض الكورسات والمحاضرات"
        >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'lectures'}
          onClick={() => setTab('lectures')}
          className={cn(
            'rounded-lg px-5 py-2 text-sm font-bold transition-colors',
            tab === 'lectures'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground',
          )}
        >
          المحاضرات
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'courses'}
          onClick={() => setTab('courses')}
          className={cn(
            'rounded-lg px-5 py-2 text-sm font-bold transition-colors',
            tab === 'courses'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground',
          )}
        >
          الكورسات
        </button>
      </div>
      {tab === 'courses' && (
        <Button onClick={() => openCreateCourse()} className="w-full sm:w-auto">
          <Plus className="mr-2 size-4" />
          إنشاء كورس جديد
        </Button>
      )}
    </div>

      {tab === 'lectures' ? (
        <div className="space-y-6">
          <LecturesStats />
          <LecturesGrid />
        </div>
      ) : (
        <CoursesGrid />
      )}
    </div>
  )
}
