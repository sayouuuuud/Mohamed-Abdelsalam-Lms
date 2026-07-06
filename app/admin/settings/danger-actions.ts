'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'

// Fixed confirmation password for the destructive wipe action.
const WIPE_PASSWORD = '000000'

/**
 * Permanently deletes ALL site data (students, courses, payments, exams,
 * messages, logs, …) EXCEPT the public-page content + settings tables
 * (site_content, site_theme, settings) and the acting admin's own account.
 *
 * Guarded by: full-admin role + a fixed confirmation password.
 * Relies on the `admin_wipe_all_data` DB function (scripts/wipe_data.sql),
 * which must be applied on the live DB first.
 */
export async function wipeAllData(password: string) {
  const supabase = await createClient()

  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن كامل الصلاحيات.' }
  }

  if (password !== WIPE_PASSWORD) {
    return { error: 'كلمة المرور غير صحيحة.' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'انتهت الجلسة. سجّل الدخول من جديد وحاول تاني.' }
  }

  // Log BEFORE wiping (the row is removed by the wipe itself, but this records
  // the intent in case anything fails mid-way).
  await logActivity({
    action: 'delete',
    resource: 'settings',
    targetLabel: 'مسح كل بيانات الموقع (Danger Zone)',
  }).catch(() => {})

  const admin = createAdminClient()
  const { error } = await admin.rpc('admin_wipe_all_data', {
    keep_admin_id: user.id,
  })

  if (error) {
    console.log('[v0] wipeAllData error:', error.message)
    // Most common cause: the DB function has not been applied yet.
    if (error.message.toLowerCase().includes('function') && error.message.includes('admin_wipe_all_data')) {
      return {
        error: 'دالة المسح غير موجودة في قاعدة البيانات. شغّل ملف scripts/wipe_data.sql على الـ live DB الأول.',
      }
    }
    return { error: 'تعذّر مسح البيانات: ' + error.message }
  }

  return { success: true }
}
