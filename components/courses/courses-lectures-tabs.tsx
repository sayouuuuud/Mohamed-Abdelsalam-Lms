'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LecturesStats } from './lectures-stats'
import { LecturesGrid } from './lectures-grid'
import { CoursesGrid } from '@/components/categories/courses-grid'

export function CoursesLecturesTabs() {
  const [tab, setTab] = useState<'lectures' | 'courses'>('lectures')

  return (
    <div className="space-y-5">
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
