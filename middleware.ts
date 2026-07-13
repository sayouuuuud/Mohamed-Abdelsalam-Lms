import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image files (.svg, .png, .jpg, .jpeg, .gif, .webp)
     * - font files (.woff, .woff2, .otf, .ttf)
     * - SEO/PWA files (robots.txt, sitemap.xml, manifest.webmanifest, opengraph-image)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|otf|ttf)$).*)',
  ],
}
