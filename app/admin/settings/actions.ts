'use server'

import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import { revalidatePath } from 'next/cache'
import { getSiteContent } from '@/lib/site-content'

// ── Site Content (public CMS) ──────────────────────────────────────────────

export async function getSiteContentForAdmin() {
  return getSiteContent()
}

export async function updateSiteContentSection(
  section: string,
  value: unknown,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  if (!section || typeof section !== 'string') {
    return { error: 'القسم غير صالح.' }
  }

  const { error } = await supabase
    .from('site_content')
    .upsert(
      { section, value, updated_at: new Date().toISOString() },
      { onConflict: 'section' },
    )

  if (error) {
    console.log('[v0] updateSiteContentSection error:', error.message)
    return { error: 'تعذّر حفظ القسم. حاول تاني.' }
  }

  logActivity({ action: 'update', resource: 'settings', targetLabel: `محتوى الموقع — قسم: ${section}` }).catch(() => {})
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function resetSiteContentSection(
  section: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase
    .from('site_content')
    .delete()
    .eq('section', section)

  if (error) {
    console.log('[v0] resetSiteContentSection error:', error.message)
    return { error: 'تعذّر استعادة الافتراضي. حاول تاني.' }
  }

  logActivity({ action: 'delete', resource: 'settings', targetLabel: `إعادة ضبط قسم: ${section}` }).catch(() => {})
  revalidatePath('/', 'layout')
  return { success: true }
}

// Loads the currently signed-in admin's profile for the settings page/header.
export async function getAdminProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, phone, avatar_url, role')
    .eq('id', user.id)
    .single()

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

// Updates the signed-in admin's profile (name, phone, bio) and avatar picture.
export async function updateAdminProfile(input: {
  fullName: string
  phone: string
  avatarUrl?: string | null
}) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'لازم تسجّل دخول.' }

  const fullName = input.fullName.trim()
  if (!fullName) return { error: 'الاسم مطلوب.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone: input.phone.trim(),
      avatar_url: input.avatarUrl || null,
    })
    .eq('id', user.id)

  if (error) {
    console.log('[v0] updateAdminProfile error:', error.message)
    return { error: 'تعذّر حفظ الملف الشخصي. حاول تاني.' }
  }

  logActivity({ action: 'update', resource: 'settings', targetLabel: `الملف الشخصي: ${fullName}` }).catch(() => {})
  revalidatePath('/admin', 'layout')
  return { success: true }
}

export async function getSettings() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'global')
    .single()

  if (error || !data) return null
  return data.value
}

// Reads the site-wide accent color from the PUBLIC theme table. Unlike
// `getSettings` (admin-only RLS), this works for any visitor / device, so the
// chosen color stays consistent everywhere — even when logged out.
export async function getSiteColor(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_theme')
    .select('active_color')
    .eq('id', true)
    .single()

  if (error || !data?.active_color) return 'navy'
  return data.active_color
}

// Reads the site-wide dark-mode neon accent preset from the PUBLIC theme table.
// Works for any visitor / device (same public-read policy as `getSiteColor`).
export async function getSiteNeon(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_theme')
    .select('neon_preset')
    .eq('id', true)
    .single()

  if (error || !data?.neon_preset) return 'teal-violet'
  return data.neon_preset
}

// Reads the site-wide light mode preset from the PUBLIC theme table.
export async function getSiteLightPreset(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_theme')
    .select('light_preset')
    .eq('id', true)
    .single()

  if (error || !data?.light_preset) return 'navy-gold'
  return data.light_preset
}

export async function updateSettings(newSettings: any) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  // Update the existing row; upsert (insert-if-missing) so a fresh project with
  // no settings row still saves. The unique `key` makes upsert idempotent.
  const { data, error } = await supabase
    .from('settings')
    .upsert(
      { key: 'global', value: newSettings, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    .select('id')

  if (error) {
    console.log('[v0] updateSettings error:', error.message)
    return { error: 'تعذّر حفظ الإعدادات. حاول تاني.' }
  }
  if (!data || data.length === 0) {
    console.log('[v0] updateSettings: no row affected')
    return { error: 'تعذّر حفظ الإعدادات (لا يوجد صف).' }
  }

  // Mirror the accent color AND the dark-mode neon preset into the
  // publicly-readable theme table so both apply on every device for every
  // visitor (the settings table is admin-only). Keep going even if this fails.
  const activeColor = newSettings?.preferences?.activeColor
  const neonPreset = newSettings?.preferences?.neonPreset
  const lightPreset = newSettings?.preferences?.lightPreset
  if (activeColor || neonPreset || lightPreset) {
    const themeRow: Record<string, unknown> = {
      id: true,
      updated_at: new Date().toISOString(),
    }
    if (activeColor) themeRow.active_color = activeColor
    if (neonPreset) themeRow.neon_preset = neonPreset
    if (lightPreset) themeRow.light_preset = lightPreset

    const { error: themeError } = await supabase
      .from('site_theme')
      .upsert(themeRow, { onConflict: 'id' })
    if (themeError) {
      console.log('[v0] updateSettings site_theme error:', themeError.message)
    }
  }

  logActivity({ action: 'update', resource: 'settings', targetLabel: 'إعدادات النظام العامة' }).catch(() => {})
  // Revalidate the whole app so the root layout re-reads the new color.
  revalidatePath('/', 'layout')
  return { success: true }
}

// ── Platform Settings ──────────────────────────────────────────────────────

export async function getPlatformSettings() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('platform_settings')
    .select('is_streaming_enabled')
    .eq('id', 1)
    .single()

  if (error || !data) return { is_streaming_enabled: false }
  return data
}

export async function updatePlatformSettings(input: { is_streaming_enabled: boolean }) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'settings', 'manage'))) {
    return { error: 'غير مسموح. لازم تكون أدمن.' }
  }

  const { error } = await supabase
    .from('platform_settings')
    .upsert({ id: 1, is_streaming_enabled: input.is_streaming_enabled, updated_at: new Date().toISOString() })

  if (error) {
    console.log('[v0] updatePlatformSettings error:', error.message)
    return { error: 'تعذّر حفظ إعدادات المنصة.' }
  }

  logActivity({ action: 'update', resource: 'settings', targetLabel: `إعدادات المنصة - الاستريمنج: ${input.is_streaming_enabled}` }).catch(() => {})
  revalidatePath('/', 'layout')
  return { success: true }
}
