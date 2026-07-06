'use server'

import { logAuthEvent, getRequestMeta } from '@/lib/audit-log'
import { createClient } from '@/lib/supabase/server'

/**
 * Called from the client right after a successful staff login.
 * The session cookie is set by the time this runs, so we can read the user.
 */
export async function recordLogin(): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

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
    // silent — never break login flow
  }
}

/**
 * Called from the client before signOut().
 * We read the session now, before it is cleared.
 */
export async function recordLogout(): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

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
    // silent — never break logout flow
  }
}
