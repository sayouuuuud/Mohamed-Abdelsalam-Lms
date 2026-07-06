'use client'

import { createContext, useContext, type ReactNode } from 'react'
import {
  type PermissionMap,
  type ResourceKey,
  type AccessLevel,
} from '@/lib/permissions'

const PermissionsContext = createContext<PermissionMap | null>(null)

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions?: PermissionMap
  children: ReactNode
}) {
  return (
    <PermissionsContext.Provider value={permissions ?? null}>
      {children}
    </PermissionsContext.Provider>
  )
}

/** Access level for a resource. Returns 'manage' when no map is present (admin default). */
export function useAccessLevel(resource: ResourceKey): AccessLevel {
  const map = useContext(PermissionsContext)
  if (!map) return 'manage'
  return map[resource] ?? 'none'
}

/** True when the current user can create/update/delete within a resource. */
export function useCanManage(resource: ResourceKey): boolean {
  return useAccessLevel(resource) === 'manage'
}
