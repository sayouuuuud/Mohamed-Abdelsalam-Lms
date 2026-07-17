'use server'

import { logAuthEvent, getRequestMeta } from '@/lib/audit-log'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function recordLogin(): Promise<void> {
  try {
    const session = await auth()
    const user = session?.user as any
    if (!user) return

    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { full_name: true, role: true }
    })

    if (!profile) return
    const role = profile.role as string
    if (role !== 'admin' && role !== 'assistant') return

    const { ip, userAgent } = await getRequestMeta()

    await logAuthEvent({
      event: 'login',
      actorId: user.id,
      actorName: profile.full_name ?? 'غير معروف',
      actorRole: role,
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    })
  } catch {
    // silent
  }
}

export async function recordLogout(): Promise<void> {
  try {
    const session = await auth()
    const user = session?.user as any
    if (!user) return

    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { full_name: true, role: true }
    })

    if (!profile) return
    const role = profile.role as string
    if (role !== 'admin' && role !== 'assistant') return

    const { ip, userAgent } = await getRequestMeta()

    await logAuthEvent({
      event: 'logout',
      actorId: user.id,
      actorName: profile.full_name ?? 'غير معروف',
      actorRole: role,
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    })
  } catch {
    // silent
  }
}
