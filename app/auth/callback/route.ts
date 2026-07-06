import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logAuthEvent, getRequestMeta } from '@/lib/audit-log'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Decide where to send the user based on their role.
      let destination = next ?? '/student'
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user && !next) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single()
        const role = profile?.role
        destination =
          role === 'admin' || role === 'assistant'
            ? '/admin/dashboard'
            : '/student'

        // Log staff login from OAuth/magic-link callback.
        if (role === 'admin' || role === 'assistant') {
          const { ip, userAgent } = await getRequestMeta()
          logAuthEvent({
            event: 'login',
            actorId: user.id,
            actorName: profile?.full_name ?? 'غير معروف',
            actorRole: role,
            ip: ip ?? undefined,
            userAgent: userAgent ?? undefined,
          }).catch(() => {})
        }
      }
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
