import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { mapPathToResource, RESOURCES } from '@/lib/permissions'

// Routes that do NOT require authentication.
const PUBLIC_PATHS = ['/', '/auth', '/stages']

function isPublicPath(pathname: string) {
  if (pathname === '/') return true
  return PUBLIC_PATHS.some(
    (p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`)),
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and supabase.auth.getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Unauthenticated user trying to reach a protected route -> /auth
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  // Role-based protection for the /admin dashboard.
  if (user && pathname.startsWith('/admin')) {
    // Always allow the fallback page to avoid redirect loops.
    if (pathname === '/admin/no-access') {
      return supabaseResponse
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role

    // Non-staff (students / unknown) never reach the admin area.
    if (role !== 'admin' && role !== 'assistant') {
      const url = request.nextUrl.clone()
      url.pathname = '/student'
      return NextResponse.redirect(url)
    }

    // Assistants are limited to the resources granted to them.
    if (role === 'assistant') {
      const { data: perms } = await supabase
        .from('assistant_permissions')
        .select('resource, access_level')
        .eq('profile_id', user.id)

      const granted = new Map(
        (perms ?? [])
          .filter((p: any) => p.access_level && p.access_level !== 'none')
          .map((p: any) => [p.resource, p.access_level]),
      )

      const resource = mapPathToResource(pathname)
      const hasAccess = resource ? granted.has(resource) : false

      if (!hasAccess) {
        const url = request.nextUrl.clone()
        // Send them to their first allowed page, or a no-access notice.
        const firstAllowed = RESOURCES.find((r) => granted.has(r.key))
        url.pathname = firstAllowed ? firstAllowed.href : '/admin/no-access'
        return NextResponse.redirect(url)
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}
