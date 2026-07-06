import Image from 'next/image'
import { PanelCard } from './panel-card'
export function TopCourses({ courses = [] }: { courses?: any[] }) {
  return (
    <PanelCard title="أكثر المحاضرات مبيعاً" filter="هذا الشهر">
      <ul className="space-y-1">
        {courses.slice(0, 4).map((course) => (
          <li
            key={course.title}
            className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-secondary/60"
          >
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
              <p className="text-xs text-muted-foreground">{course.students}</p>
            </div>
            <span className="shrink-0 text-sm font-bold text-foreground">
              {course.revenue}
            </span>
          </li>
        ))}
      </ul>
    </PanelCard>
  )
}
