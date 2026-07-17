'use server'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import { revalidatePath } from 'next/cache'

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

export async function exportSettingsBackup(): Promise<
  { success: true; backup: SettingsBackup } | { error: string }
> {
  if (!(await requireAdmin())) {
    return { error: 'غير مسموح. لازم تكون أدمن كامل.' }
  }

  try {
    const [settings, content, theme] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'global' }, select: { value: true } }),
      prisma.site_content.findMany({ select: { section: true, value: true } }),
      prisma.site_theme.findUnique({ where: { id: true }, select: { active_color: true, neon_preset: true } }),
    ])

    const backup: SettingsBackup = {
      type: BACKUP_TYPE,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        settings: settings?.value ?? null,
        siteContent: content.map((r) => ({ section: r.section, value: r.value })),
        siteTheme: theme ? { active_color: theme.active_color, neon_preset: theme.neon_preset } : null,
      },
    }

    logActivity({ action: 'create', resource: 'settings', targetLabel: 'تصدير نسخة احتياطية للإعدادات' }).catch(() => {})
    return { success: true, backup }
  } catch (error: any) {
    return { error: 'تعذّر تجهيز النسخة الاحتياطية. حاول تاني.' }
  }
}

export async function importSettingsBackup(
  backup: unknown,
): Promise<{ success: true; restored: { settings: boolean; sections: number; theme: boolean } } | { error: string }> {
  if (!(await requireAdmin())) {
    return { error: 'غير مسموح. لازم تكون أدمن كامل.' }
  }

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
  let restoredSettings = false
  let restoredSections = 0
  let restoredTheme = false

  try {
    if (settings !== null && settings !== undefined) {
      await prisma.settings.upsert({
        where: { key: 'global' },
        update: { value: settings as any, updated_at: new Date() },
        create: { key: 'global', value: settings as any, updated_at: new Date() }
      })
      restoredSettings = true
    }

    if (Array.isArray(siteContent) && siteContent.length > 0) {
      const rows = siteContent.filter((r) => r && typeof r.section === 'string')
      if (rows.length > 0) {
        for (const row of rows) {
          await prisma.site_content.upsert({
            where: { section: row.section },
            update: { value: row.value as any, updated_at: new Date() },
            create: { section: row.section, value: row.value as any, updated_at: new Date() }
          })
        }
        restoredSections = rows.length
      }
    }

    if (siteTheme && typeof siteTheme === 'object') {
      const themeData: any = { updated_at: new Date() }
      if (siteTheme.active_color) themeData.active_color = siteTheme.active_color
      if (siteTheme.neon_preset) themeData.neon_preset = siteTheme.neon_preset
      
      if (themeData.active_color || themeData.neon_preset) {
        await prisma.site_theme.upsert({
          where: { id: true },
          update: themeData,
          create: { id: true, ...themeData }
        })
        restoredTheme = true
      }
    }

    logActivity({
      action: 'update',
      resource: 'settings',
      targetLabel: `استعادة نسخة احتياطية (${restoredSections} قسم محتوى)`,
    }).catch(() => {})

    revalidatePath('/', 'layout')
    revalidatePath('/admin/settings')

    return { success: true, restored: { settings: restoredSettings, sections: restoredSections, theme: restoredTheme } }
  } catch (error: any) {
    return { error: 'تعذر استعادة بعض البيانات. قد تكون هناك مشكلة في الاتصال بقاعدة البيانات.' }
  }
}
