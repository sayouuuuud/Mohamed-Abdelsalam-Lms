'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────────────────────────────────────
// Settings & Site-Content backup / restore (full admins only).
//
// Scope (per product decision): ONLY configuration data —
//   • settings      → the single key='global' row (system preferences)
//   • site_content  → all CMS sections (hero, features, ... , seo)
//   • site_theme    → the single id=true row (accent color + neon preset)
//
// Student / course / payment data is intentionally NOT included.
// Restore uses UPSERT (merge) — it never deletes existing rows.
// ─────────────────────────────────────────────────────────────────────────────

const BACKUP_TYPE = 'lms-settings-backup'
const BACKUP_VERSION = 1

export interface SettingsBackup {
  type: typeof BACKUP_TYPE
  version: number
  exportedAt: string
  data: {
    settings: unknown | null
    siteContent: { section: string; value: unknown }[]
    siteTheme: { active_color?: string; neon_preset?: string } | null
  }
}

/**
 * Build a full settings + site-content backup object. Full admins only.
 * Returns the backup payload; the client turns it into a downloadable file.
 */
export async function exportSettingsBackup(): Promise<
  { success: true; backup: SettingsBackup } | { error: string }
> {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن كامل.' }
  }

  const [settingsRes, contentRes, themeRes] = await Promise.all([
    supabase.from('settings').select('value').eq('key', 'global').maybeSingle(),
    supabase.from('site_content').select('section, value'),
    supabase.from('site_theme').select('active_color, neon_preset').eq('id', true).maybeSingle(),
  ])

  if (settingsRes.error || contentRes.error || themeRes.error) {
    console.log(
      '[v0] exportSettingsBackup error:',
      settingsRes.error?.message,
      contentRes.error?.message,
      themeRes.error?.message,
    )
    return { error: 'تعذّر تجهيز النسخة الاحتياطية. حاول تاني.' }
  }

  const backup: SettingsBackup = {
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: settingsRes.data?.value ?? null,
      siteContent: (contentRes.data ?? []).map((r) => ({ section: r.section, value: r.value })),
      siteTheme: themeRes.data ?? null,
    },
  }

  logActivity({ action: 'create', resource: 'settings', targetLabel: 'تصدير نسخة احتياطية للإعدادات' }).catch(() => {})
  return { success: true, backup }
}

/**
 * Restore settings + site content from a backup object (UPSERT / merge).
 * Full admins only. Never deletes existing rows.
 */
export async function importSettingsBackup(
  backup: unknown,
): Promise<{ success: true; restored: { settings: boolean; sections: number; theme: boolean } } | { error: string }> {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن كامل.' }
  }

  // ── Validate the file shape before touching the DB ──
  if (!backup || typeof backup !== 'object') {
    return { error: 'ملف النسخة الاحتياطية غير صالح.' }
  }
  const b = backup as Partial<SettingsBackup>
  if (b.type !== BACKUP_TYPE) {
    return { error: 'الملف ده مش نسخة احتياطية صالحة لإعدادات المنصة.' }
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    return { error: 'إصدار النسخة الاحتياطية غير مدعوم.' }
  }
  if (!b.data || typeof b.data !== 'object') {
    return { error: 'محتوى النسخة الاحتياطية فارغ أو تالف.' }
  }

  const { settings, siteContent, siteTheme } = b.data
  const now = new Date().toISOString()
  let restoredSettings = false
  let restoredSections = 0
  let restoredTheme = false

  // ── 1) Global settings (upsert on key) ──
  if (settings !== null && settings !== undefined) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'global', value: settings, updated_at: now }, { onConflict: 'key' })
    if (error) {
      console.log('[v0] importSettingsBackup settings error:', error.message)
      return { error: 'تعذّر استعادة الإعدادات العامة.' }
    }
    restoredSettings = true
  }

  // ── 2) Site content sections (upsert each on section) ──
  if (Array.isArray(siteContent) && siteContent.length > 0) {
    const rows = siteContent
      .filter((r) => r && typeof r.section === 'string')
      .map((r) => ({ section: r.section, value: r.value, updated_at: now }))
    if (rows.length > 0) {
      const { error } = await supabase.from('site_content').upsert(rows, { onConflict: 'section' })
      if (error) {
        console.log('[v0] importSettingsBackup site_content error:', error.message)
        return { error: 'تعذّر استعادة محتوى الموقع.' }
      }
      restoredSections = rows.length
    }
  }

  // ── 3) Site theme (upsert single row) ──
  if (siteTheme && typeof siteTheme === 'object') {
    const themeRow: Record<string, unknown> = { id: true, updated_at: now }
    if (siteTheme.active_color) themeRow.active_color = siteTheme.active_color
    if (siteTheme.neon_preset) themeRow.neon_preset = siteTheme.neon_preset
    if (themeRow.active_color || themeRow.neon_preset) {
      const { error } = await supabase.from('site_theme').upsert(themeRow, { onConflict: 'id' })
      if (error) {
        console.log('[v0] importSettingsBackup site_theme error:', error.message)
        return { error: 'تعذّر استعادة ثيم الموقع.' }
      }
      restoredTheme = true
    }
  }

  logActivity({
    action: 'update',
    resource: 'settings',
    targetLabel: `استعادة نسخة احتياطية (${restoredSections} قسم محتوى)`,
  }).catch(() => {})

  // Refresh the whole app so restored theme/content/settings apply everywhere.
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')

  return { success: true, restored: { settings: restoredSettings, sections: restoredSections, theme: restoredTheme } }
}
