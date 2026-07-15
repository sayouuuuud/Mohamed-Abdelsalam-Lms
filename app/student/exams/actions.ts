'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStudent } from '@/lib/auth-guard'

export type StudentExamQuestion = {
  id: string
  type: 'mcq' | 'essay' | 'file'
  contentMode: 'text' | 'image'
  text: string
  imageUrl: string | null
  points: number
  options: string[]
}

export type StudentAnswerReview = {
  questionId: string
  awardedPoints: number
  isCorrect: boolean | null
  needsManual: boolean
  selectedOption: string | null
  answerText: string | null
  fileUrl: string | null
  correctAnswer: string | null
  modelAnswer: string | null
}

export type StudentExam = {
  code: string
  title: string
  course: string | null
  description: string | null
  durationMinutes: number
  passMark: number
  totalPoints: number
  questions: StudentExamQuestion[]
  // Present when the student already submitted.
  submission: {
    score: number
    total: number
    status: string
    gradingStatus: 'graded' | 'pending'
    submittedAt: string
    answers: StudentAnswerReview[]
  } | null
}

// Shared targeting rule — MUST stay in sync with getStudentExams() in
// app/student/actions.ts. An exam is accessible to a student if ANY holds:
//   a) broadcast: stage_id IS NULL AND branch_id IS NULL
//   b) stage-targeted: exam.stage_id === student.stage_id (regardless of branch)
//   c) branch-targeted: student purchased a lecture in exam.branch_id
// Previously the open/submit path required branch purchase even for
// stage-targeted exams, so exams that showed in the list failed to open.
async function studentCanAccessExam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  student: any,
  exam: { stage_id?: string | null; branch_id?: string | null },
): Promise<boolean> {
  const hasStage = !!exam.stage_id
  const hasBranch = !!exam.branch_id

  // Broadcast — visible to everyone.
  if (!hasStage && !hasBranch) return true

  // Stage match — visible to all students in the stage.
  if (hasStage && student.stage_id && exam.stage_id === student.stage_id) return true

  // Branch match — student must have purchased a lecture in that branch.
  if (hasBranch) {
    const { data: orders } = await supabase
      .from('orders')
      .select('order_items(lecture_id)')
      .eq('student_id', student.id)
      .eq('status', 'approved')

    const purchasedLectureIds: string[] = []
    for (const o of orders ?? []) {
      for (const item of (o.order_items as any[]) ?? []) {
        if (item.lecture_id) purchasedLectureIds.push(item.lecture_id)
      }
    }

    if (purchasedLectureIds.length > 0) {
      const { data: lectures } = await supabase
        .from('lectures')
        .select('branch_id')
        .in('id', purchasedLectureIds)
        .eq('branch_id', exam.branch_id)
      if ((lectures ?? []).length > 0) return true
    }
  }

  return false
}

// Loads a published exam for the student to take or review. Correct answers /
// model answers are ONLY included in the review payload after submission.
export async function getStudentExam(code: string): Promise<StudentExam | null> {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return null

  // Support both UUID id and alphanumeric code in the URL param.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)
  const { data: exam } = await supabase
    .from('exams')
    .select('id, code, title, course, description, duration, pass_mark, status, stage_id, branch_id')
    .eq(isUuid ? 'id' : 'code', code)
    .single()

  if (!exam || exam.status !== 'منشور') return null

  if (!(await studentCanAccessExam(supabase, student, exam))) return null

  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, question_text, question_type, content_mode, image_url, points, options, order_index')
    .eq('exam_id', exam.id)
    .order('order_index', { ascending: true })

  const qList: StudentExamQuestion[] = (questions ?? []).map((q: any) => ({
    id: q.id,
    type: (q.question_type ?? 'mcq') as 'mcq' | 'essay' | 'file',
    contentMode: (q.content_mode ?? 'text') as 'text' | 'image',
    text: q.question_text ?? '',
    imageUrl: q.image_url ?? null,
    points: q.points ?? 1,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
  }))

  const totalPoints = qList.reduce((sum, q) => sum + (q.points || 0), 0)

  // Existing submission (if any) for review.
  const { data: submission } = await supabase
    .from('exam_submissions')
    .select('id, score, total, status, grading_status, submitted_at')
    .eq('exam_id', exam.id)
    .eq('student_id', student.id)
    .maybeSingle()

  let submissionPayload: StudentExam['submission'] = null

  if (submission) {
    const { data: answers } = await supabase
      .from('exam_answers')
      .select('question_id, awarded_points, is_correct, needs_manual, selected_option, answer_text, file_url')
      .eq('submission_id', submission.id)

    // Correct answers / model answers are safe to reveal now (post-submit).
    const { data: keys } = await supabase
      .from('exam_questions')
      .select('id, correct_answer, model_answer')
      .eq('exam_id', exam.id)

    const keyMap = new Map(
      (keys ?? []).map((k: any) => [k.id, { correct: k.correct_answer, model: k.model_answer }]),
    )

    submissionPayload = {
      score: submission.score ?? 0,
      total: submission.total ?? totalPoints,
      status: submission.status ?? '',
      gradingStatus: (submission.grading_status ?? 'graded') as 'graded' | 'pending',
      submittedAt: submission.submitted_at ?? '',
      answers: (answers ?? []).map((a: any) => ({
        questionId: a.question_id,
        awardedPoints: a.awarded_points ?? 0,
        isCorrect: a.is_correct,
        needsManual: a.needs_manual ?? false,
        selectedOption: a.selected_option ?? null,
        answerText: a.answer_text ?? null,
        fileUrl: a.file_url ?? null,
        correctAnswer: keyMap.get(a.question_id)?.correct ?? null,
        modelAnswer: keyMap.get(a.question_id)?.model ?? null,
      })),
    }
  }

  return {
    code: exam.code,
    title: exam.title,
    course: exam.course,
    description: exam.description,
    durationMinutes: exam.duration || 30,
    passMark: exam.pass_mark ?? 50,
    totalPoints,
    questions: qList,
    submission: submissionPayload,
  }
}

export type SubmitAnswer = {
  questionId: string
  selectedOption?: string | null
  answerText?: string | null
  fileUrl?: string | null
}

// Persists a student's exam attempt, auto-grading MCQ questions and flagging
// essay/file questions for manual grading.
export async function submitExam(code: string, answers: SubmitAnswer[]) {
  const supabase = await createClient()
  const student = await getCurrentStudent(supabase)
  if (!student) return { success: false, error: 'لازم تسجّل دخول.' }

  const { data: exam } = await supabase
    .from('exams')
    .select('id, code, pass_mark, status, stage_id, branch_id')
    .eq('code', code)
    .single()

  if (!exam || exam.status !== 'منشور') {
    return { success: false, error: 'الاختبار غير متاح.' }
  }

  // Same targeting rule as the list and the open path.
  if (!(await studentCanAccessExam(supabase, student, exam))) {
    return { success: false, error: 'غير مسموح لك بتسليم هذا الاختبار.' }
  }

  // Prevent duplicate submissions.
  const { data: existing } = await supabase
    .from('exam_submissions')
    .select('id')
    .eq('exam_id', exam.id)
    .eq('student_id', student.id)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'لقد قمت بتسليم هذا الاختبار من قبل.' }
  }

  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, question_type, correct_answer, points')
    .eq('exam_id', exam.id)

  const qList = questions ?? []
  const totalPoints = qList.reduce((sum: number, q: any) => sum + (q.points || 0), 0)
  const answerMap = new Map(answers.map((a) => [a.questionId, a]))

  let autoScore = 0
  let hasManual = false

  const answerRows = qList.map((q: any) => {
    const given = answerMap.get(q.id)
    if (q.question_type === 'mcq') {
      const selected = given?.selectedOption ?? null
      const isCorrect = selected != null && selected === q.correct_answer
      const awarded = isCorrect ? q.points || 0 : 0
      autoScore += awarded
      return {
        question_id: q.id,
        selected_option: selected,
        answer_text: null,
        file_url: null,
        awarded_points: awarded,
        is_correct: isCorrect,
        needs_manual: false,
      }
    }
    // essay / file -> manual grading
    hasManual = true
    return {
      question_id: q.id,
      selected_option: null,
      answer_text: given?.answerText ?? null,
      file_url: given?.fileUrl ?? null,
      awarded_points: 0,
      is_correct: null,
      needs_manual: true,
    }
  })

  const gradingStatus = hasManual ? 'pending' : 'graded'
  const score = autoScore
  const percent = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0
  const status = hasManual
    ? 'قيد التصحيح'
    : percent >= (exam.pass_mark ?? 50)
      ? 'ناجح'
      : 'راسب'

  const { data: submission, error: subError } = await supabase
    .from('exam_submissions')
    .insert({
      exam_id: exam.id,
      student_id: student.id,
      score,
      total: totalPoints,
      auto_score: autoScore,
      manual_score: 0,
      grading_status: gradingStatus,
      status,
    })
    .select('id')
    .single()

  if (subError || !submission) {
    console.log('[v0] submitExam submission error:', subError?.message)
    return { success: false, error: 'تعذر تسليم الاختبار.' }
  }

  if (answerRows.length > 0) {
    const rows = answerRows.map((r) => ({ ...r, submission_id: submission.id }))
    const { error: ansError } = await supabase.from('exam_answers').insert(rows)
    if (ansError) {
      console.log('[v0] submitExam answers error:', ansError.message)
      await supabase.from('exam_submissions').delete().eq('id', submission.id)
      return { success: false, error: 'تعذر حفظ الإجابات.' }
    }
  }

  revalidatePath('/student/exams')
  revalidatePath(`/student/exams/${code}`)
  return {
    success: true,
    gradingStatus,
    score,
    total: totalPoints,
    status,
  }
}
