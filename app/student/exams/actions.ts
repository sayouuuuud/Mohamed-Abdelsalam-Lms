'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
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
  submission: {
    score: number
    total: number
    status: string
    gradingStatus: 'graded' | 'pending'
    submittedAt: string
    answers: StudentAnswerReview[]
  } | null
}

async function studentCanAccessExam(
  student: any,
  exam: { stage_id?: string | null; branch_id?: string | null },
): Promise<boolean> {
  const hasStage = !!exam.stage_id
  const hasBranch = !!exam.branch_id

  if (!hasStage && !hasBranch) return true
  if (hasStage && student.stage_id && exam.stage_id === student.stage_id) return true

  if (hasBranch) {
    const orders = await prisma.orders.findMany({
      where: { student_id: student.id, status: 'approved' },
      include: { order_items: { select: { lecture_id: true } } }
    })

    const purchasedLectureIds: string[] = []
    for (const o of orders) {
      for (const item of o.order_items) {
        if (item.lecture_id) purchasedLectureIds.push(item.lecture_id)
      }
    }

    if (purchasedLectureIds.length > 0) {
      const lectures = await prisma.lectures.findMany({
        where: { id: { in: purchasedLectureIds }, branch_id: exam.branch_id as string },
        select: { id: true }
      })
      if (lectures.length > 0) return true
    }
  }

  return false
}

export async function getStudentExam(code: string): Promise<StudentExam | null> {
  const student = await getCurrentStudent()
  if (!student) return null

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)
  
  let exam
  if (isUuid) {
    exam = await prisma.exams.findUnique({
      where: { id: code },
      select: { id: true, code: true, title: true, course: true, description: true, duration: true, pass_mark: true, status: true, stage_id: true, branch_id: true }
    })
  } else {
    exam = await prisma.exams.findFirst({
      where: { code },
      select: { id: true, code: true, title: true, course: true, description: true, duration: true, pass_mark: true, status: true, stage_id: true, branch_id: true }
    })
  }

  if (!exam || exam.status !== 'منشور') return null
  if (!(await studentCanAccessExam(student, exam))) return null

  const questions = await prisma.exam_questions.findMany({
    where: { exam_id: exam.id },
    select: { id: true, question_text: true, question_type: true, content_mode: true, image_url: true, points: true, options: true, order_index: true, correct_answer: true, model_answer: true },
    orderBy: { order_index: 'asc' }
  })

  const qList: StudentExamQuestion[] = questions.map((q) => ({
    id: q.id,
    type: (q.question_type ?? 'mcq') as 'mcq' | 'essay' | 'file',
    contentMode: (q.content_mode ?? 'text') as 'text' | 'image',
    text: q.question_text ?? '',
    imageUrl: q.image_url ?? null,
    points: q.points ?? 1,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
  }))

  const totalPoints = qList.reduce((sum, q) => sum + (q.points || 0), 0)

  const submission = await prisma.exam_submissions.findFirst({
    where: { exam_id: exam.id, student_id: student.id },
    select: { id: true, score: true, total: true, status: true, grading_status: true, submitted_at: true }
  })

  let submissionPayload: StudentExam['submission'] = null

  if (submission) {
    const answers = await prisma.exam_answers.findMany({
      where: { submission_id: submission.id },
      select: { question_id: true, awarded_points: true, is_correct: true, needs_manual: true, selected_option: true, answer_text: true, file_url: true }
    })

    const keyMap = new Map(
      questions.map((k) => [k.id, { correct: k.correct_answer, model: k.model_answer }]),
    )

    submissionPayload = {
      score: submission.score ?? 0,
      total: submission.total ?? totalPoints,
      status: submission.status ?? '',
      gradingStatus: (submission.grading_status ?? 'graded') as 'graded' | 'pending',
      submittedAt: submission.submitted_at ? submission.submitted_at.toISOString() : '',
      answers: answers.map((a) => ({
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

export async function submitExam(code: string, answers: SubmitAnswer[]) {
  const student = await getCurrentStudent()
  if (!student) return { success: false, error: 'لازم تسجّل دخول.' }

  const exam = await prisma.exams.findFirst({
    where: { code },
    select: { id: true, code: true, pass_mark: true, status: true, stage_id: true, branch_id: true }
  })

  if (!exam || exam.status !== 'منشور') {
    return { success: false, error: 'الاختبار غير متاح.' }
  }

  if (!(await studentCanAccessExam(student, exam))) {
    return { success: false, error: 'غير مسموح لك بتسليم هذا الاختبار.' }
  }

  const existing = await prisma.exam_submissions.findFirst({
    where: { exam_id: exam.id, student_id: student.id },
    select: { id: true }
  })

  if (existing) {
    return { success: false, error: 'لقد قمت بتسليم هذا الاختبار من قبل.' }
  }

  const questions = await prisma.exam_questions.findMany({
    where: { exam_id: exam.id },
    select: { id: true, question_type: true, correct_answer: true, points: true }
  })

  const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0)
  const answerMap = new Map(answers.map((a) => [a.questionId, a]))

  let autoScore = 0
  let hasManual = false

  const answerRows = questions.map((q: any) => {
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

  try {
    const submission = await prisma.exam_submissions.create({
      data: {
        exam_id: exam.id,
        student_id: student.id,
        score,
        total: totalPoints,
        auto_score: autoScore,
        manual_score: 0,
        grading_status: gradingStatus,
        status,
        exam_answers: {
          create: answerRows
        }
      },
      select: { id: true }
    })

    revalidatePath('/student/exams')
    revalidatePath(`/student/exams/${code}`)
    return {
      success: true,
      gradingStatus,
      score,
      total: totalPoints,
      status,
    }
  } catch (error: any) {
    console.log('[v0] submitExam error:', error.message)
    return { success: false, error: 'تعذر تسليم الاختبار.' }
  }
}
