'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import {
  type AccessLevel,
  type ResourceKey,
  RESOURCE_KEYS,
} from '@/lib/permissions'

export type AssistantRecord = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  permissions: Partial<Record<ResourceKey, AccessLevel>>
  grantedCount: number
  createdAt: string
}

const LEVELS: AccessLevel[] = ['none', 'view', 'manage']

function sanitizePermissions(
  input: Record<string, string> | undefined,
): { resource: ResourceKey; access_level: AccessLevel }[] {
  const rows: { resource: ResourceKey; access_level: AccessLevel }[] = []
  if (!input) return rows
  for (const key of RESOURCE_KEYS) {
    const level = input[key]
    if (level && LEVELS.includes(level as AccessLevel) && level !== 'none') {
      rows.push({ resource: key, access_level: level as AccessLevel })
    }
  }
  return rows
}

/** True when the current session belongs to a full admin (role = 'admin'). */
export async function isCurrentUserFullAdmin(): Promise<boolean> {
  const supabase = await createClient()
  return requireAdmin(supabase)
}

/** List all assistants with their permission maps. Full admins only. */
export async function listAssistants(): Promise<AssistantRecord[]> {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) return []

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, created_at')
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })

  if (error || !profiles) {
    console.log('[v0] listAssistants error:', error?.message)
    return []
  }

  const ids = profiles.map((p) => p.id)
  const permsByProfile = new Map<string, Partial<Record<ResourceKey, AccessLevel>>>()

  if (ids.length) {
    const { data: perms } = await supabase
      .from('assistant_permissions')
      .select('profile_id, resource, access_level')
      .in('profile_id', ids)

    for (const row of perms ?? []) {
      const map = permsByProfile.get(row.profile_id) ?? {}
      map[row.resource as ResourceKey] = row.access_level as AccessLevel
      permsByProfile.set(row.profile_id, map)
    }
  }

  return profiles.map((p) => {
    const permissions = permsByProfile.get(p.id) ?? {}
    const grantedCount = Object.values(permissions).filter(
      (l) => l && l !== 'none',
    ).length
    return {
      id: p.id,
      name: p.full_name ?? '',
      email: p.email ?? '',
      avatarUrl: p.avatar_url ?? null,
      permissions,
      grantedCount,
      createdAt: p.created_at,
    }
  })
}

/** Create a new assistant login + profile + permission rows. Full admins only. */
export async function createAssistant(input: {
  name: string
  email: string
  password: string
  permissions: Record<string, string>
}) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  if (!input.name.trim() || !input.email.trim() || !input.password) {
    return { error: 'الاسم والبريد وكلمة المرور مطلوبة.' }
  }
  if (input.password.length < 6) {
    return { error: 'كلمة المرور لازم تكون 6 حروف على الأقل.' }
  }

  const admin = createAdminClient()
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.name, role: 'assistant' },
  })

  if (authError || !created.user) {
    console.log('[v0] createAssistant auth error:', authError?.message)
    return {
      error: authError?.message.toLowerCase().includes('already')
        ? 'البريد الإلكتروني مستخدم بالفعل.'
        : 'تعذّر إنشاء حساب المساعد. حاول تاني.',
    }
  }

  const userId = created.user.id

  // Upsert the profile with role = assistant (a trigger may have created a row).
  const { error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: input.name,
        email: input.email,
        role: 'assistant',
      },
      { onConflict: 'id' },
    )

  if (profileError) {
    console.log('[v0] createAssistant profile error:', profileError.message)
    return { error: 'تعذّر حفظ بيانات المساعد.' }
  }

  const rows = sanitizePermissions(input.permissions).map((r) => ({
    profile_id: userId,
    resource: r.resource,
    access_level: r.access_level,
  }))
  if (rows.length) {
    const { error: permError } = await admin
      .from('assistant_permissions')
      .insert(rows)
    if (permError) {
      console.log('[v0] createAssistant perms error:', permError.message)
      return { error: 'تم إنشاء الحساب لكن تعذّر حفظ الصلاحيات.' }
    }
  }

  logActivity({ action: 'create', resource: 'settings', targetId: userId, targetLabel: `مساعد جديد: ${input.name} (${input.email})` }).catch(() => {})
  revalidatePath('/admin/settings')
  return { success: true }
}

/** Replace an assistant's permission map. Full admins only. */
export async function updateAssistantPermissions(
  profileId: string,
  permissions: Record<string, string>,
) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const admin = createAdminClient()

  // Ensure the target is actually an assistant.
  const { data: target } = await admin
    .from('profiles')
    .select('role')
    .eq('id', profileId)
    .single()
  if (target?.role !== 'assistant') {
    return { error: 'الحساب ده مش مساعد.' }
  }

  // Reset then insert the new set (simple + consistent).
  await admin.from('assistant_permissions').delete().eq('profile_id', profileId)

  const rows = sanitizePermissions(permissions).map((r) => ({
    profile_id: profileId,
    resource: r.resource,
    access_level: r.access_level,
  }))
  if (rows.length) {
    const { error } = await admin.from('assistant_permissions').insert(rows)
    if (error) {
      console.log('[v0] updateAssistantPermissions error:', error.message)
      return { error: 'تعذّر تحديث الصلاحيات.' }
    }
  }

  logActivity({ action: 'update', resource: 'settings', targetId: profileId, targetLabel: `صلاحيات مساعد ID: ${profileId}` }).catch(() => {})
  revalidatePath('/admin/settings')
  return { success: true }
}

/**
 * Remove an assistant: demote to 'student' role and clear permissions.
 * Keeps the auth account and history intact.
 */
export async function deleteAssistant(profileId: string) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const admin = createAdminClient()
  await admin.from('assistant_permissions').delete().eq('profile_id', profileId)
  const { error } = await admin
    .from('profiles')
    .update({ role: 'student' })
    .eq('id', profileId)
    .eq('role', 'assistant')

  if (error) {
    console.log('[v0] deleteAssistant error:', error.message)
    return { error: 'تعذّر إزالة المساعد.' }
  }

  logActivity({ action: 'delete', resource: 'settings', targetId: profileId, targetLabel: `إزالة مساعد ID: ${profileId}` }).catch(() => {})
  revalidatePath('/admin/settings')
  return { success: true }
}
