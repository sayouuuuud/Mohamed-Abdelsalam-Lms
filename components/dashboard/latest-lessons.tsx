import Image from 'next/image'
import { PanelCard } from './panel-card'
import { cn } from '@/lib/utils'

export function LatestLessons({ lessons = [] }: { lessons?: any[] }) {
  return (
    <PanelCard title="آخر المحاضرات المضافة" action="عرض الكل" actionHref="/admin/courses">
      <ul className="divide-y divide-border">
        {lessons.map((lesson) => (
          <li key={lesson.title} className="flex items-center gap-3 py-3 first:pt-0">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={lesson.image || '/placeholder.svg'}
                alt={lesson.title}
                fill
                sizes="44px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {lesson.title}
              </p>
              <span
                className={cn(
                  'mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  lesson.status === 'منشور'
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/15 text-warning-foreground dark:text-warning',
                )}
              >
                {lesson.status}
              </span>
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {lesson.time}
            </span>
          </li>
        ))}
      </ul>
    </PanelCard>
  )
}
