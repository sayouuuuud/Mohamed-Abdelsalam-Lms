// server-only — never import this in client components or middleware.
import 'server-only'

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import type { ResourceKey } from '@/lib/permissions'

export type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'reject'
export type AuthEvent = 'login' | 'logout'

interface ActivityParams {
  action: AuditAction
  resource: ResourceKey
  targetId?: string
  targetLabel?: string
  details?: string
}

interface AuthEventParams {
  event: AuthEvent
  actorId: string
  actorName: string
  actorRole: string
  ip?: string
  userAgent?: string
}

export async function getRequestMeta(): Promise<{
  ip: string | null
  userAgent: string | null
}> {
  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : h.get('x-real-ip')
    const userAgent = h.get('user-agent')
    return { ip, userAgent }
  } catch {
    return { ip: null, userAgent: null }
  }
}

export async function logActivity(params: ActivityParams): Promise<void> {
  try {
    const session = await auth()
    const user = session?.user

    if (!user || !user.id) return

    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { full_name: true, role: true }
    })

    if (!profile) return

    const role = profile.role as string
    if (role !== 'admin' && role !== 'assistant') return

    await prisma.activity_logs.create({
      data: {
        actor_id: user.id,
        actor_name: profile.full_name ?? 'غير معروف',
        actor_role: role,
        action: params.action,
        resource: params.resource,
        target_id: params.targetId ?? null,
        target_label: params.targetLabel ?? null,
        details: params.details ?? null,
      }
    })
  } catch (err) {
    console.error('[audit] logActivity unexpected error:', err)
  }
}

export async function logAuthEvent(params: AuthEventParams): Promise<void> {
  try {
    await prisma.auth_logs.create({
      data: {
        actor_id: params.actorId,
        actor_name: params.actorName,
        actor_role: params.actorRole,
        event: params.event,
        ip: params.ip ?? null,
        user_agent: params.userAgent ?? null,
      }
    })
  } catch (err) {
    console.error('[audit] logAuthEvent unexpected error:', err)
  }
}
