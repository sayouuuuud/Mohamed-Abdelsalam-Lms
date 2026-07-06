import { ShieldAlert } from 'lucide-react'

export default function NoAccessPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-secondary">
        <ShieldAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">لا توجد صلاحيات كافية</h1>
        <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          حسابك لا يملك صلاحية الوصول إلى أي صفحة في لوحة التحكم حتى الآن. تواصل مع
          المسؤول لمنحك الصلاحيات المناسبة.
        </p>
      </div>
    </div>
  )
}
