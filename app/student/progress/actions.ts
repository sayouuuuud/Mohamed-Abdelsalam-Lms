'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Marks a single lesson as completed for the current student. `lessonId` is the
// lesson's database UUID. Idempotent via the unique (user_id, item_type, item_id).
// Also records learning activity based on the lesson's stored duration.
export async function markLessonComplete(lessonId: string, courseSlug?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'يجب تسجيل الدخول.' }

  const { error } = await supabase
    .from('student_content_progress')
    .upsert(
      {
        user_id: user.id,
        item_type: 'lesson',
        item_id: lessonId,
        status: 'completed',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,item_type,item_id' },
    )

  if (error) {
    return { error: 'تعذّر حفظ التقدّم.' }
  }

  // Fire-and-forget: estimate lesson minutes from its duration field (e.g. "12:30").
  void recordLearningActivityFromLesson(supabase, user.id, lessonId)

  if (courseSlug) revalidatePath(`/student/courses/${courseSlug}`)
  revalidatePath('/student/courses')
  return { success: true }
}

// ── recordLearningActivity ────────────────────────────────────────────────────
// Adds `minutes` to the current student's learning_activity row for today.
// Upserts on (student_id, activity_date) — the unique constraint added in M1.
export async function recordLearningActivity(minutes: number) {
  if (minutes <= 0) return { error: 'المدة يجب أن تكون أكبر من صفر.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'يجب تسجيل الدخول.' }

  const { data: studentRow } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!studentRow) return { error: 'لم يتم العثور على بيانات الطالب.' }

  const today = new Date().toISOString().split('T')[0]

  // Read existing minutes for today first so we can add to them.
  const { data: existing } = await supabase
    .from('learning_activity')
    .select('minutes')
    .eq('student_id', studentRow.id)
    .eq('activity_date', today)
    .single()

  const newMinutes = (existing?.minutes ?? 0) + minutes

  const { error } = await supabase.from('learning_activity').upsert(
    {
      student_id: studentRow.id,
      activity_date: today,
      minutes: newMinutes,
    },
    { onConflict: 'student_id,activity_date' },
  )

  if (error) return { error: error.message }
  return { success: true }
}

// ── Internal helper ──────────────────────────────────────────────────────────
// Resolves lesson duration from DB and calls recordLearningActivity.
// Called internally by markLessonComplete — not exported.
async function recordLearningActivityFromLesson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  lessonId: string,
) {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('duration')
    .eq('id', lessonId)
    .single()
  if (!lesson?.duration) return

  // Parse "MM:SS" or "HH:MM:SS" format into minutes.
  const parts = String(lesson.duration).split(':').map(Number)
  let minutes = 0
  if (parts.length === 2) minutes = (parts[0] ?? 0) + (parts[1] ?? 0) / 60
  else if (parts.length === 3) minutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0) + (parts[2] ?? 0) / 60

  if (minutes <= 0) return

  const { data: studentRow } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (!studentRow) return

  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('learning_activity')
    .select('minutes')
    .eq('student_id', studentRow.id)
    .eq('activity_date', today)
    .single()

  await supabase.from('learning_activity').upsert(
    {
      student_id: studentRow.id,
      activity_date: today,
      minutes: (existing?.minutes ?? 0) + Math.round(minutes),
    },
    { onConflict: 'student_id,activity_date' },
  )
}

// Records an assignment submission for the current student.
// Writes to assignment_submissions (the real table) keyed by the assignment's
// UUID. For all-MCQ assignments the score is stored immediately and status is
// set to 'مصحّح'; otherwise it is 'تم التسليم' and awaits manual grading.
export async function submitAssignmentProgress(
  assignmentCode: string,
  payload: { status: 'تم التسليم' | 'مصحّح'; score?: number; courseSlug?: string },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'يجب تسجيل الدخول.' }

  // Resolve the student row.
  const { data: studentRow } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!studentRow) return { error: 'لم يتم العثور على بيانات الطالب.' }

  // Resolve assignment UUID from its code or ID.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignmentCode)
  const { data: asgRow } = await supabase
    .from('assignments')
    .select('id')
    .eq(isUuid ? 'id' : 'code', assignmentCode)
    .single()
  if (!asgRow) return { error: 'الواجب غير موجود.' }

  const { error } = await supabase
    .from('assignment_submissions')
    .upsert(
      {
        assignment_id: asgRow.id,
        student_id: studentRow.id,
        status: payload.status,
        score: payload.score ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'assignment_id,student_id' },
    )

  if (error) {
    return { error: 'تعذّر حفظ التسليم.' }
  }

  // Record it in the unified curriculum progress table so the next item unlocks
  await supabase
    .from('student_content_progress')
    .upsert(
      {
        user_id: user.id,
        item_type: 'assignment',
        item_id: asgRow.id,
        status: payload.status,
        score: payload.score ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,item_type,item_id' },
    )

  if (payload.courseSlug) revalidatePath(`/student/courses/${payload.courseSlug}`)
  revalidatePath('/student/assignments')
  return { success: true }
}
