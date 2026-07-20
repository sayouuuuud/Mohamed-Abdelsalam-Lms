'use server'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import { auth } from '@/auth'

const WIPE_PASSWORD = '000000'

export async function wipeAllData(password: string) {
  if (!(await requireAdmin())) {
    return { error: 'غير مسموح. لازم تكون أدمن كامل الصلاحيات.' }
  }

  if (password !== WIPE_PASSWORD) {
    return { error: 'كلمة المرور غير صحيحة.' }
  }

  const session = await auth()
  const user = session?.user
  if (!user) {
    return { error: 'انتهت الجلسة. سجّل الدخول من جديد وحاول تاني.' }
  }

  await logActivity({
    action: 'delete',
    resource: 'settings',
    targetLabel: 'مسح كل بيانات الموقع (Danger Zone)',
  }).catch(() => {})

  try {
    await prisma.$executeRaw`SELECT admin_wipe_all_data(${user.id}::uuid)`
    return { success: true }
  } catch (error: any) {
    console.log('[v0] wipeAllData error:', error.message)
    if (error.message.toLowerCase().includes('function') && error.message.includes('admin_wipe_all_data')) {
      return {
        error: 'دالة المسح غير موجودة في قاعدة البيانات. شغّل ملف scripts/wipe_data.sql على الـ live DB الأول.',
      }
    }
    return { error: 'تعذّر مسح البيانات: ' + error.message }
  }
}
