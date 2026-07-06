'use server'

import { createClient } from '@/lib/supabase/server'

// Heartbeat: marks the currently logged-in student as "seen just now".
// Called periodically by the student portal while the tab is active. Kept
// intentionally lightweight (a single indexed UPDATE by user_id) so it is cheap
// to call every minute.
export async function pingPresence(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false }

    const { error } = await supabase
      .from('students')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (error) {
      console.log('[v0] pingPresence error:', error.message)
      return { ok: false }
    }
    return { ok: true }
  } catch (e) {
    console.log('[v0] pingPresence exception:', (e as Error).message)
    return { ok: false }
  }
}
