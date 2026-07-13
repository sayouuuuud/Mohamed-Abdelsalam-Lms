'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import type {
  StudentGender,
  StudentRecord,
  StudentStatus,
} from '@/lib/students-data'

export type StudentInput = {
  name: string
  email: string
  password?: string
  phone: string
  gender: StudentGender
  status: StudentStatus
  stageId?: string | null
}

export type StageOption = { id: string; title: string }

// Academic years used to assign a student and drive the branch comparison.
export async function getStages(): Promise<StageOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stages')
    .select('id, title, sort_order')
    .order('sort_order', { ascending: true })
  if (error) {
    console.log('[v0] getStages error:', error.message)
    return []
  }
  return (data || []).map((s: any) => ({ id: s.id, title: s.title }))
}

// Guards student writes (create/delete). These use the service-role client,
// so we enforce 'manage' at the app layer instead of relying on RLS.
async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  return hasResourceAccess(supabase, 'students', 'manage')
}

type StudentRow = {
  id: string
  code: string
  name: string
  email: string | null
  phone: string | null
  gender: StudentGender
  avatar: string | null
  courses: number
  progress: number
  spent: string
  status: StudentStatus
  joined_at: string
}

function formatJoinedAt(date: string): string {
  try {
    return new Date(date).toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return date
  }
}

function mapRow(row: StudentRow): StudentRecord {
  return {
    // The UI uses `id` as the human-readable identifier (e.g. STD-1042),
    // so we expose `code` here while keeping the uuid internal to the DB.
    id: row.code,
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    gender: row.gender,
    avatar: row.avatar ?? undefined,
    courses: row.courses,
    progress: row.progress,
    spent: row.spent,
    status: row.status,
    joinedAt: formatJoinedAt(row.joined_at),
  }
}

export async function getStudents(): Promise<StudentRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('students')
    .select(
      'id, code, name, email, phone, gender, avatar, courses, progress, spent, status, joined_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.log('[v0] getStudents error:', error.message)
    return []
  }
  return (data as StudentRow[]).map(mapRow)
}

export async function getStudentsStats() {
  const supabase = await createClient()
  
  if (!(await hasResourceAccess(supabase, 'students'))) {
    return null
  }

  const { data: studentsRaw } = await supabase
    .from('students')
    .select('id, status, created_at')

  if (!studentsRaw) return null

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // Current window
  const totalThis = studentsRaw.length
  const activeThis = studentsRaw.filter(s => s.status === 'نشط').length
  const suspendedThis = studentsRaw.filter(s => s.status === 'موقوف').length
  const newThis = studentsRaw.filter(s => new Date(s.created_at) >= thirtyDaysAgo).length

  // Previous window (for Total, Active, Suspended - these are cumulative, so previous is total up to 30 days ago)
  const studentsPrevWindow = studentsRaw.filter(s => new Date(s.created_at) < thirtyDaysAgo)
  const totalPrev = studentsPrevWindow.length
  const activePrev = studentsPrevWindow.filter(s => s.status === 'نشط').length
  const suspendedPrev = studentsPrevWindow.filter(s => s.status === 'موقوف').length
  
  // Previous window (for New - this is a discrete bucket, so it's between 60 and 30 days ago)
  const newPrev = studentsRaw.filter(s => new Date(s.created_at) >= sixtyDaysAgo && new Date(s.created_at) < thirtyDaysAgo).length

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 1000) / 10
  }

  return {
    total: totalThis,
    totalChange: calcChange(totalThis, totalPrev),
    active: activeThis,
    activeChange: calcChange(activeThis, activePrev),
    new: newThis,
    newChange: calcChange(newThis, newPrev),
    suspended: suspendedThis,
    suspendedChange: calcChange(suspendedThis, suspendedPrev)
  }
}

async function generateStudentCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const { data } = await supabase
    .from('students')
    .select('code')
    .order('code', { ascending: false })
    .limit(1)
    .maybeSingle()

  let next = 1043
  if (data?.code) {
    const parsed = parseInt(String(data.code).replace(/[^0-9]/g, ''), 10)
    if (!Number.isNaN(parsed)) next = parsed + 1
  }
  return `STD-${next}`
}

export async function createStudent(input: StudentInput) {
  const supabase = await createClient()

  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن عشان تضيف طالب.' }
  }

  const code = await generateStudentCode(supabase)
  let userId: string | null = null

  // If a password is provided, create a real login account for the student.
  if (input.email && input.password) {
    const admin = createAdminClient()
    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.name, phone: input.phone, role: 'student' },
    })
    if (authError) {
      console.log('[v0] createStudent auth error:', authError.message)
      return {
        error: authError.message.toLowerCase().includes('already')
          ? 'البريد الإلكتروني مستخدم بالفعل.'
          : 'تعذّر إنشاء حساب الطالب. حاول تاني.',
      }
    }
    userId = created.user?.id ?? null
  }

  const { error } = await supabase.from('students').insert({
    code,
    user_id: userId,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    gender: input.gender,
    status: input.status,
    stage_id: input.stageId || null,
  })

  if (error) {
    console.log('[v0] createStudent error:', error.message)
    return { error: 'تعذّر إضافة الطالب. تأكد من صلاحياتك وحاول تاني.' }
  }

  logActivity({ action: 'create', resource: 'students', targetId: code, targetLabel: `طالب: ${input.name}` }).catch(() => {})
  revalidatePath('/students')
  return { success: true }
}

export async function deleteStudent(code: string) {
  const supabase = await createClient()

  if (!(await requireAdmin(supabase))) {
    return { error: 'غير مسموح. لازم تكون أدمن عشان تحذف طالب.' }
  }

  // Grab the linked auth user id BEFORE deleting the row so we can also
  // remove the login account — otherwise the student could still sign in.
  const { data: row } = await supabase
    .from('students')
    .select('user_id')
    .eq('code', code)
    .maybeSingle()

  const { error } = await supabase.from('students').delete().eq('code', code)

  if (error) {
    console.log('[v0] deleteStudent error:', error.message)
    return { error: 'تعذّر حذف الطالب.' }
  }

  // Delete the auth account too so the credentials stop working entirely.
  if (row?.user_id) {
    try {
      const admin = createAdminClient()
      const { error: authErr } = await admin.auth.admin.deleteUser(row.user_id)
      if (authErr) {
        console.log('[v0] deleteStudent auth delete error:', authErr.message)
      }
    } catch (e) {
      console.log('[v0] deleteStudent auth delete threw:', e instanceof Error ? e.message : String(e))
    }
  }

  logActivity({ action: 'delete', resource: 'students', targetId: code, targetLabel: `طالب كود: ${code}` }).catch(() => {})
  revalidatePath('/students')
  return { success: true }
}
