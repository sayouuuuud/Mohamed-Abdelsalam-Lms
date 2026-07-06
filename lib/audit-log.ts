// server-only — never import this in client components or middleware.
import 'server-only'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ResourceKey } from '@/lib/permissions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper: extract IP + user-agent from incoming request headers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// logActivity — logs a write action (create / update / delete / approve / reject)
// ---------------------------------------------------------------------------

export async function logActivity(params: ActivityParams): Promise<void> {
  try {
    // 1. Resolve the current session via the anon client (reads the cookie).
    const sessionClient = await createClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()

    if (!user) return

    // 2. Fetch actor name + role from profiles.
    const { data: profile } = await sessionClient
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    if (!profile) return

    // 3. Only staff actions are logged — ignore student sessions.
    const role = profile.role as string
    if (role !== 'admin' && role !== 'assistant') return

    // 4. Write via service-role client (bypasses RLS insert restriction).
    const adminClient = createAdminClient()
    const { error } = await adminClient.from('activity_logs').insert({
      actor_id: user.id,
      actor_name: profile.full_name ?? 'غير معروف',
      actor_role: role,
      action: params.action,
      resource: params.resource,
      target_id: params.targetId ?? null,
      target_label: params.targetLabel ?? null,
      details: params.details ?? null,
    })

    if (error) {
      console.error('[audit] logActivity insert error:', error.message)
    }
  } catch (err) {
    // Never throw — logging must never break the calling action.
    console.error('[audit] logActivity unexpected error:', err)
  }
}

// ---------------------------------------------------------------------------
// logAuthEvent — logs login / logout
// Called with explicit actor info because the session may not exist yet
// (login) or may already be cleared (logout).
// ---------------------------------------------------------------------------

export async function logAuthEvent(params: AuthEventParams): Promise<void> {
  try {
    const adminClient = createAdminClient()
    const { error } = await adminClient.from('auth_logs').insert({
      actor_id: params.actorId,
      actor_name: params.actorName,
      actor_role: params.actorRole,
      event: params.event,
      ip: params.ip ?? null,
      user_agent: params.userAgent ?? null,
    })

    if (error) {
      console.error('[audit] logAuthEvent insert error:', error.message)
    }
  } catch (err) {
    console.error('[audit] logAuthEvent unexpected error:', err)
  }
}
