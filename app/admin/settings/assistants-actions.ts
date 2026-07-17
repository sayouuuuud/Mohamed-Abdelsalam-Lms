'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import bcrypt from 'bcryptjs'
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

export async function isCurrentUserFullAdmin(): Promise<boolean> {
  return requireAdmin()
}

export async function listAssistants(): Promise<AssistantRecord[]> {
  if (!(await requireAdmin())) return []

  const users = await prisma.profiles.findMany({
    where: { role: 'assistant' },
    select: { id: true, full_name: true, email: true, avatar_url: true, created_at: true },
    orderBy: { created_at: 'desc' }
  })

  if (!users || users.length === 0) return []

  const ids = users.map((u) => u.id)
  const permsByProfile = new Map<string, Partial<Record<ResourceKey, AccessLevel>>>()

  const perms = await prisma.assistant_permissions.findMany({
    where: { profile_id: { in: ids } },
    select: { profile_id: true, resource: true, access_level: true }
  })

  for (const row of perms) {
    const map = permsByProfile.get(row.profile_id) ?? {}
    map[row.resource as ResourceKey] = row.access_level as AccessLevel
    permsByProfile.set(row.profile_id, map)
  }

  return users.map((u) => {
    const permissions = permsByProfile.get(u.id) ?? {}
    const grantedCount = Object.values(permissions).filter((l) => l && l !== 'none').length
    return {
      id: u.id,
      name: u.full_name ?? '',
      email: u.email ?? '',
      avatarUrl: u.avatar_url ?? null,
      permissions,
      grantedCount,
      createdAt: u.created_at ? u.created_at.toISOString() : new Date().toISOString(),
    }
  })
}

export async function createAssistant(input: {
  name: string
  email: string
  password: string
  permissions: Record<string, string>
}) {
  if (!(await requireAdmin())) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  if (!input.name.trim() || !input.email.trim() || !input.password) {
    return { error: 'الاسم والبريد وكلمة المرور مطلوبة.' }
  }
  if (input.password.length < 6) {
    return { error: 'كلمة المرور لازم تكون 6 حروف على الأقل.' }
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { email: input.email.trim() }
    })

    if (existing) {
      return { error: 'البريد الإلكتروني مستخدم بالفعل.' }
    }

    const hashedPassword = bcrypt.hashSync(input.password, 10)

    const userId = crypto.randomUUID()
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: input.email.trim(),
        encrypted_password: hashedPassword,
        role: 'assistant',
      }
    })
    await prisma.profiles.create({
      data: {
        id: userId,
        full_name: input.name.trim(),
        email: input.email.trim(),
        role: 'assistant',
      }
    })

    const rows = sanitizePermissions(input.permissions).map((r) => ({
      profile_id: user.id,
      resource: r.resource,
      access_level: r.access_level,
    }))

    if (rows.length > 0) {
      await prisma.assistant_permissions.createMany({ data: rows })
    }

    logActivity({ action: 'create', resource: 'settings', targetId: user.id, targetLabel: `مساعد جديد: ${input.name} (${input.email})` }).catch(() => {})
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إنشاء الحساب. تأكد من البيانات وحاول مرة أخرى.' }
  }
}

export async function updateAssistantPermissions(
  profileId: string,
  permissions: Record<string, string>,
) {
  if (!(await requireAdmin())) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const target = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { role: true }
  })

  if (target?.role !== 'assistant') {
    return { error: 'الحساب ده مش مساعد.' }
  }

  try {
    await prisma.assistant_permissions.deleteMany({
      where: { profile_id: profileId }
    })

    const rows = sanitizePermissions(permissions).map((r) => ({
      profile_id: profileId,
      resource: r.resource,
      access_level: r.access_level,
    }))

    if (rows.length > 0) {
      await prisma.assistant_permissions.createMany({ data: rows })
    }

    logActivity({ action: 'update', resource: 'settings', targetId: profileId, targetLabel: `صلاحيات مساعد ID: ${profileId}` }).catch(() => {})
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر تحديث الصلاحيات.' }
  }
}

export async function deleteAssistant(profileId: string) {
  if (!(await requireAdmin())) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.assistant_permissions.deleteMany({
      where: { profile_id: profileId }
    })

    await prisma.profiles.update({
      where: { id: profileId },
      data: { role: 'student' }
    })

    await prisma.user.update({
      where: { id: profileId },
      data: { role: 'student' }
    })

    logActivity({ action: 'delete', resource: 'settings', targetId: profileId, targetLabel: `إزالة مساعد ID: ${profileId}` }).catch(() => {})
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إزالة المساعد.' }
  }
}
