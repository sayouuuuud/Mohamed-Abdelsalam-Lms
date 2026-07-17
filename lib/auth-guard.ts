import 'server-only'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
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
export async function getCurrentRole(): Promise<StaffRole> {
  const session = await auth()
  return (session?.user as any)?.role ?? null
}

/** True only for full admins (role = 'admin'). */
export async function requireAdmin() {
  return (await getCurrentRole()) === 'admin'
}

/** True for any staff member (admin or assistant). */
export async function isStaff() {
  const role = await getCurrentRole()
  return role === 'admin' || role === 'assistant'
}

/**
 * Resolves the current user's permission map across all resources.
 * - admin      => every resource = 'manage'
 * - assistant  => from assistant_permissions rows (missing => 'none')
 * - otherwise  => every resource = 'none'
 */
export async function getPermissionMap(): Promise<PermissionMap> {
  const session = await auth()
  const user = session?.user as any
  const role = user?.role

  if (role === 'admin') return fullPermissionMap('manage')
  if (role !== 'assistant') return fullPermissionMap('none')

  const map = fullPermissionMap('none')
  if (!user) return map

  const permissions = user.permissions || []
  for (const row of permissions) {
    const key = row.resource as ResourceKey
    if (RESOURCE_KEYS.includes(key)) {
      map[key] = (row.access_level as AccessLevel) ?? 'none'
    }
  }
  return map
}

/**
 * True if the current user can access a resource at the required level.
 * Used by server actions as a lightweight app-level guard.
 */
export async function hasResourceAccess(
  resource: ResourceKey,
  level: AccessLevel = 'view',
): Promise<boolean> {
  const role = await getCurrentRole()
  if (role === 'admin') return true
  if (role !== 'assistant') return false
  const map = await getPermissionMap()
  return satisfies(map[resource], level)
}

/** يرجّع صف students المرتبط بالمستخدم الحالي (للبوابة الطلابية). */
export async function getCurrentStudent() {
  const session = await auth()
  const user = session?.user
  if (!user) return null
  const data = await prisma.students.findFirst({
    where: { user_id: user.id }
  })
  return data
}
