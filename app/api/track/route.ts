import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

// Lightweight visit tracker. Called once per page load from the client.
// Inserts through the service-role client (bypasses RLS); the table has
// no client INSERT policy, so this is the only write path.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VISITOR_COOKIE = 'v_id'
const ONE_YEAR = 60 * 60 * 24 * 365

// Very small UA classifier — enough for a device split, no dependency needed.
function classifyDevice(ua: string): 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown' {
  if (!ua) return 'unknown'
  const s = ua.toLowerCase()
  if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly/.test(s)) return 'bot'
  if (/ipad|tablet|(android(?!.*mobile))/.test(s)) return 'tablet'
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(s)) return 'mobile'
  return 'desktop'
}

// Only a pathname is stored — strip query/hash and ignore admin + api paths.
function isTrackablePath(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.startsWith('/admin')) return false
  if (path.startsWith('/api')) return false
  return true
}

export async function POST(request: Request) {
  try {
    let body: { path?: string } = {}
    try {
      body = await request.json()
    } catch {
      // empty / invalid body — treat as root
    }

    const rawPath = (body.path || '/').split('?')[0].split('#')[0]
    if (!isTrackablePath(rawPath)) {
      return Response.json({ ok: true, skipped: true })
    }

    // Stable anonymous visitor id, stored in an httpOnly cookie.
    const cookieStore = await cookies()
    let visitorId = cookieStore.get(VISITOR_COOKIE)?.value
    let isNewVisitor = false
    if (!visitorId || !/^[0-9a-f-]{36}$/i.test(visitorId)) {
      visitorId = randomUUID()
      isNewVisitor = true
    }

    const ua = request.headers.get('user-agent') || ''
    const device = classifyDevice(ua)

    await prisma.$executeRaw`
      INSERT INTO page_views (path, visitor_id, device, created_at)
      VALUES (${rawPath.slice(0, 512)}, ${visitorId}, ${device}, NOW())
    `

    const res = Response.json({ ok: true })
    if (isNewVisitor) {
      // Set-Cookie manually so we can attach it to this Response.
      res.headers.append(
        'Set-Cookie',
        `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; SameSite=Lax${
          process.env.NODE_ENV === 'production' ? '; Secure' : ''
        }`,
      )
    }
    return res
  } catch {
    // Never let tracking break a page — always succeed silently.
    return Response.json({ ok: false }, { status: 200 })
  }
}
