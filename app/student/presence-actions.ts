'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function pingPresence(): Promise<{ ok: boolean }> {
  try {
    const session = await auth()
    const user = session?.user
    if (!user) return { ok: false }

    await prisma.students.updateMany({
      where: { user_id: user.id },
      data: { last_seen_at: new Date() }
    })

    return { ok: true }
  } catch (e) {
    console.log('[v0] pingPresence exception:', (e as Error).message)
    return { ok: false }
  }
}
