import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PanelCard } from './panel-card'
import { getInitials } from '@/lib/get-initials'

export function LatestStudents({ students = [] }: { students?: any[] }) {
  return (
    <PanelCard title="آخر الطلاب المسجلين" action="عرض الكل" actionHref="/admin/students">
      <ul className="divide-y divide-border">
        {students.map((student) => (
          <li key={student.email} className="flex items-center gap-3 py-3 first:pt-0">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(student.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{student.name}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {student.email}
              </p>
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {student.time}
            </span>
          </li>
        ))}
      </ul>
    </PanelCard>
  )
}
