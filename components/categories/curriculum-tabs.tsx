'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CurriculumGrid } from './curriculum-grid'
import { CoursesGrid } from './courses-grid'

export function CurriculumTabs() {
  const [tab, setTab] = useState<'branches' | 'courses'>('branches')

  return (
    <div className="space-y-5">
      <div
        className="flex w-fit items-center gap-1 rounded-xl border border-border bg-secondary/50 p-1"
        role="tablist"
        aria-label="عرض التصنيفات"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'branches'}
          onClick={() => setTab('branches')}
          className={cn(
            'rounded-lg px-5 py-2 text-sm font-bold transition-colors',
            tab === 'branches'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground',
          )}
        >
          الفروع
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

      {tab === 'branches' ? <CurriculumGrid /> : <CoursesGrid />}
    </div>
  )
}
