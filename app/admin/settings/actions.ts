'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import { revalidatePath } from 'next/cache'
import { getSiteContent } from '@/lib/site-content'
import { auth } from '@/auth'

export async function getSiteContentForAdmin() {
  return getSiteContent()
}

export async function updateSiteContentSection(
  section: string,
  value: unknown,
): Promise<{ success?: true; error?: string }> {
  if (!(await hasResourceAccess('settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  if (!section || typeof section !== 'string') {
    return { error: 'القسم غير صالح.' }
  }

  try {
    await prisma.site_content.upsert({
      where: { section },
      update: { value: value as any, updated_at: new Date() },
      create: { section, value: value as any, updated_at: new Date() }
    })

    logActivity({ action: 'update', resource: 'settings', targetLabel: `محتوى الموقع — قسم: ${section}` }).catch(() => {})
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حفظ القسم. حاول تاني.' }
  }
}

export async function resetSiteContentSection(
  section: string,
): Promise<{ success?: true; error?: string }> {
  if (!(await hasResourceAccess('settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.site_content.delete({
      where: { section }
    })

    logActivity({ action: 'delete', resource: 'settings', targetLabel: `إعادة ضبط قسم: ${section}` }).catch(() => {})
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر استعادة الافتراضي. حاول تاني.' }
  }
}

export async function getAdminProfile() {
  const session = await auth()
  const user = session?.user
  if (!user) return null

  const profile = await prisma.profiles.findUnique({
    where: { id: user.id },
    select: { full_name: true, email: true, phone: true, avatar_url: true, role: true }
  })

  const fullName = profile?.full_name || ''
  return {
    fullName,
    email: profile?.email || user.email || '',
    phone: profile?.phone || '',
    avatarUrl: profile?.avatar_url || '',
    role: profile?.role || 'admin',
    initials: (fullName || 'أ').trim().slice(0, 2),
  }
}

export async function updateAdminProfile(input: {
  fullName: string
  phone: string
  avatarUrl?: string | null
}) {
  if (!(await hasResourceAccess('settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'لازم تسجّل دخول.' }

  const fullName = input.fullName.trim()
  if (!fullName) return { error: 'الاسم مطلوب.' }

  try {
    await prisma.profiles.update({
      where: { id: user.id },
      data: {
        full_name: fullName,
        phone: input.phone.trim(),
        avatar_url: input.avatarUrl || null,
      }
    })

    logActivity({ action: 'update', resource: 'settings', targetLabel: `الملف الشخصي: ${fullName}` }).catch(() => {})
    revalidatePath('/admin', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حفظ الملف الشخصي. حاول تاني.' }
  }
}

export async function getSettings() {
  const data = await prisma.settings.findUnique({
    where: { key: 'global' },
    select: { value: true }
  })

  return data?.value || null
}

export async function getSiteColor(): Promise<string> {
  const data = await prisma.site_theme.findUnique({
    where: { id: true },
    select: { active_color: true }
  })

  return data?.active_color || 'navy'
}

export async function getSiteNeon(): Promise<string> {
  const data = await prisma.site_theme.findUnique({
    where: { id: true },
    select: { neon_preset: true }
  })

  return data?.neon_preset || 'teal-violet'
}

export async function getSiteLightPreset(): Promise<string> {
  const data = await prisma.site_theme.findUnique({
    where: { id: true },
    select: { light_preset: true }
  })

  return data?.light_preset || 'navy-gold'
}

export async function updateSettings(newSettings: any) {
  if (!(await hasResourceAccess('settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.settings.upsert({
      where: { key: 'global' },
      update: { value: newSettings, updated_at: new Date() },
      create: { key: 'global', value: newSettings, updated_at: new Date() }
    })

    const activeColor = newSettings?.preferences?.activeColor
    const neonPreset = newSettings?.preferences?.neonPreset
    const lightPreset = newSettings?.preferences?.lightPreset

    if (activeColor || neonPreset || lightPreset) {
      const themeData: any = { updated_at: new Date() }
      if (activeColor) themeData.active_color = activeColor
      if (neonPreset) themeData.neon_preset = neonPreset
      if (lightPreset) themeData.light_preset = lightPreset

      await prisma.site_theme.upsert({
        where: { id: true },
        update: themeData,
        create: { id: true, ...themeData }
      }).catch(() => {})
    }

    logActivity({ action: 'update', resource: 'settings', targetLabel: 'إعدادات النظام العامة' }).catch(() => {})
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حفظ الإعدادات. حاول تاني.' }
  }
}

export async function getPlatformSettings() {
  const data = await prisma.platform_settings.findUnique({
    where: { id: 1 },
    select: { is_streaming_enabled: true }
  })

  return data || { is_streaming_enabled: false }
}

export async function updatePlatformSettings(input: { is_streaming_enabled: boolean }) {
  if (!(await hasResourceAccess('settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  try {
    await prisma.platform_settings.upsert({
      where: { id: 1 },
      update: { is_streaming_enabled: input.is_streaming_enabled, updated_at: new Date() },
      create: { id: 1, is_streaming_enabled: input.is_streaming_enabled, updated_at: new Date() }
    })

    logActivity({ action: 'update', resource: 'settings', targetLabel: `إعدادات المنصة - الاستريمنج: ${input.is_streaming_enabled}` }).catch(() => {})
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حفظ إعدادات المنصة.' }
  }
}

import bcrypt from 'bcryptjs'

export async function updateAdminPassword(newPassword: string) {
  if (!(await hasResourceAccess('settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }
  const session = await auth()
  const user = session?.user
  if (!user) return { error: 'لازم تسجّل دخول.' }

  if (!newPassword || newPassword.length < 6) {
    return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { encrypted_password: hashedPassword }
    })
    logActivity({ action: 'update', resource: 'settings', targetLabel: 'تغيير كلمة المرور' }).catch(() => {})
    return { success: true }
  } catch (err: any) {
    return { error: 'تعذّر تحديث كلمة المرور' }
  }
}
