import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  type AccessLevel,
  type PermissionMap,
  type ResourceKey,
  RESOURCE_KEYS,
  fullPermissionMap,
  satisfies,
} from '@/lib/permissions'

export type StaffRole = 'admin' | 'assistant' | 'student' | null

/** Returns the current user's role, or null if not signed in. */
export async function getCurrentRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<StaffRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return (profile?.role as StaffRole) ?? null
}

/** True only for full admins (role = 'admin'). */
export async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  return (await getCurrentRole(supabase)) === 'admin'
}

/** True for any staff member (admin or assistant). */
export async function isStaff(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const role = await getCurrentRole(supabase)
  return role === 'admin' || role === 'assistant'
}

/**
 * Resolves the current user's permission map across all resources.
 * - admin      => every resource = 'manage'
 * - assistant  => from assistant_permissions rows (missing => 'none')
 * - otherwise  => every resource = 'none'
 */
export async function getPermissionMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PermissionMap> {
  const role = await getCurrentRole(supabase)
  if (role === 'admin') return fullPermissionMap('manage')
  if (role !== 'assistant') return fullPermissionMap('none')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const map = fullPermissionMap('none')
  if (!user) return map

  const { data: rows } = await supabase
    .from('assistant_permissions')
    .select('resource, access_level')
    .eq('profile_id', user.id)

  for (const row of rows ?? []) {
    const key = row.resource as ResourceKey
    if (RESOURCE_KEYS.includes(key)) {
      map[key] = (row.access_level as AccessLevel) ?? 'none'
    }
  }
  return map
}

/**
 * True if the current user can access a resource at the required level.
 * Used by server actions as a lightweight app-level guard; the real
 * enforcement lives in RLS (has_permission).
 */
export async function hasResourceAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resource: ResourceKey,
  level: AccessLevel = 'view',
): Promise<boolean> {
  const role = await getCurrentRole(supabase)
  if (role === 'admin') return true
  if (role !== 'assistant') return false
  const map = await getPermissionMap(supabase)
  return satisfies(map[resource], level)
}

/** يرجّع صف students المرتبط بالمستخدم الحالي (للبوابة الطلابية). */
export async function getCurrentStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .single()
  return data
}
