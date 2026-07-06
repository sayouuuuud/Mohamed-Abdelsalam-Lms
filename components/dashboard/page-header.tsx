import Link from 'next/link'
import { BookOpen, UploadCloud, Tag, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

const actions = [
  { label: 'إضافة كورس', icon: BookOpen, href: '/admin/courses', primary: true },
  { label: 'رفع درس', icon: UploadCloud, href: '/admin/courses' },
  { label: 'إنشاء كوبون', icon: Tag, href: '/admin/coupons' },
  { label: 'إضافة طالب', icon: UserPlus, href: '/admin/students' },
]

export function PageHeader() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-foreground">الصفحة الرئيسية</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          مرحباً بك مجدداً، محمد أحمد <span aria-hidden="true">👋</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.primary ? 'default' : 'outline'}
              className={
                action.primary
                  ? ''
                  : 'border-border bg-card text-foreground hover:bg-secondary'
              }
              nativeButton={false}
              render={<Link href={action.href} />}
            >
              <action.icon className="size-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
