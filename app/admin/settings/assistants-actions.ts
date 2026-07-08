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

  // Build the service-role client (throws with a clear message if env is missing).
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('[v0] createAssistant admin client error:', msg)
    return { error: `إعداد Supabase ناقص: ${msg}. أضف المفتاح في إعدادات المشروع.` }
  }

  // GoTrue occasionally returns a transient AuthRetryableFetchError (500) in
  // this runtime. It's flaky, not fatal, so retry a few times with a short
  // backoff before surfacing an error to the admin.
  let created: Awaited<ReturnType<typeof admin.auth.admin.createUser>>['data'] | null = null
  let authError: Awaited<ReturnType<typeof admin.auth.admin.createUser>>['error'] = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await admin.auth.admin.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.name, role: 'assistant' },
    })
    created = res.data
    authError = res.error

    if (!authError && created?.user) break

    const retryable =
      authError?.name === 'AuthRetryableFetchError' ||
      authError?.status === 500 ||
      authError?.status === 502 ||
      authError?.status === 503 ||
      authError?.status === 504
    if (!retryable) break

    console.log(`[v0] createAssistant retryable error on attempt ${attempt}, retrying...`)
    await new Promise((r) => setTimeout(r, attempt * 400))
  }

  if (authError || !created?.user) {
    // Supabase AuthError props aren't JSON-serializable, so pull them out.
    const err = authError as unknown as
      | { message?: string; status?: number; code?: string; name?: string }
      | null
    const msg = err?.message ?? 'no user returned'
    const code = err?.code ?? ''
    const status = err?.status ?? ''
    console.log('[v0] createAssistant auth error:', JSON.stringify({ msg, code, status, name: err?.name }))

    const lower = `${msg} ${code}`.toLowerCase()
    if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
      return { error: 'البريد الإلكتروني مستخدم بالفعل.' }
    }
    if (lower.includes('invalid') && lower.includes('key')) {
      return { error: 'مفتاح الخدمة (service role key) غير صحيح. تحقق من إعدادات Supabase.' }
    }
    if (status === 401 || status === 403 || lower.includes('not authorized') || lower.includes('unauthorized')) {
      return { error: 'غير مصرح — مفتاح الخدمة غير صالح للـ live DB. تحقق من SUPABASE_SERVICE_ROLE_KEY.' }
    }
    if (lower.includes('password')) {
      return { error: 'كلمة المرور ضعيفة جداً. استخدم كلمة أقوى.' }
    }
    if (err?.name === 'AuthRetryableFetchError' || status === 500) {
      return { error: 'تعذّر الاتصال بخدمة المصادقة مؤقتاً. حاول تاني بعد لحظات.' }
    }
    return { error: `تعذّر إنشاء الحساب${msg ? `: ${msg}` : '. تأكد من مفتاح الخدمة في إعدادات المشروع.'}` }
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
