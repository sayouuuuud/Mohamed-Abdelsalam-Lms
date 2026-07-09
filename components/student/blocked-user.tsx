'use client'

import { useLogout } from '@/lib/use-logout'
import { Button } from '@/components/ui/button'

export function BlockedUser() {
  const logout = useLogout()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-destructive">حسابك موقوف</h1>
        <p className="text-muted-foreground">
          تم إيقاف حسابك من قبل الإدارة. يرجى التواصل مع الدعم الفني لمزيد من التفاصيل.
        </p>
        <Button onClick={logout} className="mt-4 rounded-full px-8">
          العودة لتسجيل الدخول
        </Button>
      </div>
    </div>
  )
}
