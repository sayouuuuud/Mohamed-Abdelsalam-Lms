import Image from 'next/image'
import { PanelCard } from './panel-card'
import { cn } from '@/lib/utils'

export function LatestCourses({ courses = [] }: { courses?: any[] }) {
  return (
    <PanelCard title="آخر الكورسات المضافة" action="عرض الكل">
      <ul className="divide-y divide-border">
        {courses.map((course) => (
          <li key={course.title} className="flex items-center gap-3 py-3 first:pt-0">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={course.image || '/placeholder.svg'}
                alt={course.title}
                fill
                sizes="44px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {course.title}
              </p>
              <span
                className={cn(
                  'mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  course.status === 'منشور'
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/15 text-warning-foreground dark:text-warning',
                )}
              >
                {course.status}
              </span>
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {course.time}
            </span>
          </li>
        ))}
      </ul>
    </PanelCard>
  )
}
