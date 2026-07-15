'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'

export type ExamQuestion = {
  id: string
  text: string
  options: string[]
  correctAnswer: string
  points: number
}

export type ExamSubmissionDetail = {
  id: string
  studentId: string
  studentName: string
  studentCode: string
  score: number
  total: number
  status: string
  gradingStatus: 'graded' | 'pending'
  submittedAt: string
}

export type ExamDetailsData = {
  id: string
  code: string
  title: string
  course: string
  duration: number
  questionsCount: number
  participants: number
  avgScore: number
  status: string
  createdAt: string
  questions: ExamQuestion[]
  submissions: ExamSubmissionDetail[]
}

export async function getExamDetails(code: string): Promise<ExamDetailsData | null> {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'exams'))) return null

  // 1. Fetch exam
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('code', code)
    .single()

  if (examError || !exam) return null

  // 2. Fetch questions
  const { data: questionsData } = await supabase
    .from('exam_questions')
    .select('*')
    .eq('exam_id', exam.id)
    .order('created_at', { ascending: true })

  const questions: ExamQuestion[] = (questionsData || []).map((q: any) => ({
    id: q.id,
    text: q.question_text,
    options: q.options as string[],
    correctAnswer: q.correct_answer,
    points: q.points,
  }))

  // 3. Fetch submissions with student info
  const { data: submissionsData } = await supabase
    .from('exam_submissions')
    .select(`
      id,
      student_id,
      score,
      total,
      status,
      grading_status,
      submitted_at,
      students (
        id,
        name,
        code
      )
    `)
    .eq('exam_id', exam.id)
    .order('submitted_at', { ascending: false })

  const submissions: ExamSubmissionDetail[] = (submissionsData || []).map((s: any) => ({
    id: s.id,
    studentId: s.students?.id || s.student_id,
    studentName: s.students?.name || 'غير معروف',
    studentCode: s.students?.code || '-',
    score: s.score,
    total: s.total,
    status: s.status,
    gradingStatus: (s.grading_status ?? 'graded') as 'graded' | 'pending',
    submittedAt: new Date(s.submitted_at).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }))

  // Calculate some stats if possible (e.g., actual average from submissions, pass rate)
  // But for now we rely on the exam fields or compute them
  const actualParticipants = submissions.length
  let avgScore = exam.avg_score
  if (actualParticipants > 0) {
    const totalScore = submissions.reduce((sum, s) => sum + (s.score / s.total) * 100, 0)
    avgScore = Math.round(totalScore / actualParticipants)
  }

  return {
    id: exam.id,
    code: exam.code,
    title: exam.title,
    course: exam.course,
    duration: exam.duration,
    questionsCount: questions.length > 0 ? questions.length : exam.questions,
    participants: actualParticipants > 0 ? actualParticipants : exam.participants,
    avgScore,
    status: exam.status,
    createdAt: new Date(exam.created_at).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    questions,
    submissions,
  }
}

// ── Grading a single submission ──────────────────────────────────

export type GradingAnswer = {
  answerId: string
  questionId: string
  questionText: string
  questionType: 'mcq' | 'essay' | 'file'
  points: number
  awardedPoints: number
  isCorrect: boolean | null
  needsManual: boolean
  selectedOption: string | null
  answerText: string | null
  fileUrl: string | null
  correctAnswer: string | null
  modelAnswer: string | null
}

export type GradingSubmission = {
  id: string
  examCode: string
  examTitle: string
  passMark: number
  studentName: string
  studentCode: string
  score: number
  total: number
  autoScore: number
  status: string
  gradingStatus: 'graded' | 'pending'
  answers: GradingAnswer[]
}

// Loads a single submission with all answers + question keys for grading.
export async function getSubmissionForGrading(
  submissionId: string,
): Promise<GradingSubmission | null> {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'exams'))) return null

  const { data: submission } = await supabase
    .from('exam_submissions')
    .select(`
      id, exam_id, score, total, auto_score, status, grading_status,
      students ( name, code ),
      exams ( code, title, pass_mark )
    `)
    .eq('id', submissionId)
    .single()

  if (!submission) return null

  const { data: answers } = await supabase
    .from('exam_answers')
    .select('id, question_id, awarded_points, is_correct, needs_manual, selected_option, answer_text, file_url')
    .eq('submission_id', submissionId)

  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, question_text, question_type, points, correct_answer, model_answer, order_index')
    .eq('exam_id', (submission as any).exam_id)
    .order('order_index', { ascending: true })

  const qMap = new Map((questions ?? []).map((q: any) => [q.id, q]))

  const mappedAnswers: GradingAnswer[] = (answers ?? []).map((a: any) => {
    const q = qMap.get(a.question_id)
    return {
      answerId: a.id,
      questionId: a.question_id,
      questionText: q?.question_text ?? '',
      questionType: (q?.question_type ?? 'mcq') as 'mcq' | 'essay' | 'file',
      points: q?.points ?? 0,
      awardedPoints: a.awarded_points ?? 0,
      isCorrect: a.is_correct,
      needsManual: a.needs_manual ?? false,
      selectedOption: a.selected_option ?? null,
      answerText: a.answer_text ?? null,
      fileUrl: a.file_url ?? null,
      correctAnswer: q?.correct_answer ?? null,
      modelAnswer: q?.model_answer ?? null,
    }
  })

  // Preserve question order.
  mappedAnswers.sort((x, y) => {
    const ox = qMap.get(x.questionId)?.order_index ?? 0
    const oy = qMap.get(y.questionId)?.order_index ?? 0
    return ox - oy
  })

  const s: any = submission
  return {
    id: s.id,
    examCode: s.exams?.code ?? '',
    examTitle: s.exams?.title ?? '',
    passMark: s.exams?.pass_mark ?? 50,
    studentName: s.students?.name ?? 'غير معروف',
    studentCode: s.students?.code ?? '-',
    score: s.score ?? 0,
    total: s.total ?? 0,
    autoScore: s.auto_score ?? 0,
    status: s.status ?? '',
    gradingStatus: (s.grading_status ?? 'graded') as 'graded' | 'pending',
    answers: mappedAnswers,
  }
}

// Applies manual grades to essay/file answers, recomputes the final score and
// marks the submission graded.
export async function gradeSubmission(
  submissionId: string,
  manualGrades: { answerId: string; awardedPoints: number }[],
) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'exams', 'manage'))) {
    return { success: false, error: 'غير مصرح لك' }
  }

  const { data: submission } = await supabase
    .from('exam_submissions')
    .select('id, exam_id, total, exams ( code, pass_mark )')
    .eq('id', submissionId)
    .single()

  if (!submission) return { success: false, error: 'التسليم غير موجود' }

  const { data: answers } = await supabase
    .from('exam_answers')
    .select('id, question_id, awarded_points, needs_manual')
    .eq('submission_id', submissionId)

  // Fetch max points per question for clamping.
  const questionIds = (answers ?? []).map((a: any) => a.question_id)
  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, points')
    .in('id', questionIds.length ? questionIds : ['00000000-0000-0000-0000-000000000000'])

  const pointsMap = new Map((questions ?? []).map((q: any) => [q.id, q.points ?? 0]))
  const gradeMap = new Map(manualGrades.map((g) => [g.answerId, g.awardedPoints]))

  let autoScore = 0
  let manualScore = 0

  for (const a of answers ?? []) {
    const maxPoints = pointsMap.get((a as any).question_id) ?? 0
    if ((a as any).needs_manual) {
      const raw = gradeMap.has((a as any).id)
        ? gradeMap.get((a as any).id)!
        : (a as any).awarded_points ?? 0
      const awarded = Math.max(0, Math.min(maxPoints, Math.round(raw)))
      manualScore += awarded
      // Persist the manual grade for this answer.
      await supabase
        .from('exam_answers')
        .update({ awarded_points: awarded, is_correct: awarded >= maxPoints })
        .eq('id', (a as any).id)
    } else {
      autoScore += (a as any).awarded_points ?? 0
    }
  }

  const s: any = submission
  const total = s.total ?? 0
  const score = autoScore + manualScore
  const percent = total > 0 ? Math.round((score / total) * 100) : 0
  const passMark = s.exams?.pass_mark ?? 50
  const status = percent >= passMark ? 'ناجح' : 'راسب'

  const { error: updateError } = await supabase
    .from('exam_submissions')
    .update({
      auto_score: autoScore,
      manual_score: manualScore,
      score,
      status,
      grading_status: 'graded',
    })
    .eq('id', submissionId)

  if (updateError) {
    console.log('[v0] gradeSubmission update error:', updateError.message)
    return { success: false, error: 'تعذر حفظ الدرجات' }
  }

  const examCode = s.exams?.code
  if (examCode) {
    revalidatePath(`/admin/exams/${examCode}`)
    revalidatePath(`/student/exams/${examCode}`)
  }
  logActivity({ action: 'update', resource: 'exams', targetId: submissionId, targetLabel: `تصحيح اختبار — النتيجة: ${score}/${total} (${status})` }).catch(() => {})
  revalidatePath('/student/exams')

  return { success: true, score, total, status }
}

// ── Update exam metadata / status ──────────────────────────────────────────────

export async function updateExam(
  examCode: string,
  updates: {
    title?: string
    course?: string
    description?: string
    duration?: number
    passMark?: number
    status?: string
  },
) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'exams', 'manage'))) {
    return { success: false, error: 'غير مصرح لك' }
  }

  const { error } = await supabase
    .from('exams')
    .update({
      ...(updates.title !== undefined && { title: updates.title.trim() }),
      ...(updates.course !== undefined && { course: updates.course.trim() || null }),
      ...(updates.description !== undefined && { description: updates.description.trim() || null }),
      ...(updates.duration !== undefined && { duration: updates.duration }),
      ...(updates.passMark !== undefined && { pass_mark: updates.passMark }),
      ...(updates.status !== undefined && { status: updates.status }),
    })
    .eq('code', examCode)

  if (error) {
    console.log('[v0] updateExam error:', error.message)
    return { success: false, error: 'تعذّر تحديث الاختبار' }
  }

  logActivity({ action: 'update', resource: 'exams', targetId: examCode, targetLabel: `تعديل اختبار: ${examCode}` }).catch(() => {})
  revalidatePath(`/admin/exams/${examCode}`)
  revalidatePath('/admin/exams')
  return { success: true }
}
