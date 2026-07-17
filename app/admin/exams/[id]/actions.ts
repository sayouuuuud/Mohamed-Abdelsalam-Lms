'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
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
  description?: string
  passMark?: number
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
  if (!(await hasResourceAccess('exams'))) return null

  const exam = await prisma.exams.findUnique({
    where: { code }
  })
  if (!exam) return null

  const [questionsData, submissionsData] = await Promise.all([
    prisma.exam_questions.findMany({
      where: { exam_id: exam.id },
      orderBy: { order_index: 'asc' }
    }),
    prisma.exam_submissions.findMany({
      where: { exam_id: exam.id },
      include: { students: { select: { id: true, name: true, code: true } } },
      orderBy: { submitted_at: 'desc' }
    })
  ])

  const questions: ExamQuestion[] = questionsData.map((q) => ({
    id: q.id,
    text: q.question_text,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    correctAnswer: q.correct_answer ?? '',
    points: q.points ?? 1,
  }))

  const submissions: ExamSubmissionDetail[] = submissionsData.map((s) => ({
    id: s.id,
    studentId: s.students?.id || s.student_id,
    studentName: s.students?.name || 'غير معروف',
    studentCode: s.students?.code || '-',
    score: s.score ?? 0,
    total: s.total ?? 0,
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

  const actualParticipants = submissions.length
  let avgScore = exam.avg_score ? Number(exam.avg_score) : 0
  if (actualParticipants > 0) {
    const totalScore = submissions.reduce((sum, s) => sum + (s.total > 0 ? (s.score / s.total) * 100 : 0), 0)
    avgScore = Math.round(totalScore / actualParticipants)
  }

  return {
    id: exam.id,
    code: exam.code,
    title: exam.title,
    course: exam.course || '',
    description: exam.description ?? '',
    duration: exam.duration ?? 0,
    passMark: exam.pass_mark ?? 50,
    questionsCount: questions.length > 0 ? questions.length : (exam.questions ?? 0),
    participants: actualParticipants > 0 ? actualParticipants : (exam.participants ?? 0),
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

export async function getSubmissionForGrading(submissionId: string): Promise<GradingSubmission | null> {
  if (!(await hasResourceAccess('exams'))) return null

  const submission = await prisma.exam_submissions.findUnique({
    where: { id: submissionId },
    include: {
      students: { select: { name: true, code: true } },
      exams: { select: { code: true, title: true, pass_mark: true } }
    }
  })
  if (!submission) return null

  const [answers, questions] = await Promise.all([
    prisma.exam_answers.findMany({
      where: { submission_id: submissionId },
      select: { id: true, question_id: true, awarded_points: true, is_correct: true, needs_manual: true, selected_option: true, answer_text: true, file_url: true }
    }),
    prisma.exam_questions.findMany({
      where: { exam_id: submission.exam_id },
      select: { id: true, question_text: true, question_type: true, points: true, correct_answer: true, model_answer: true, order_index: true },
      orderBy: { order_index: 'asc' }
    })
  ])

  const qMap = new Map(questions.map((q) => [q.id, q]))

  const mappedAnswers: GradingAnswer[] = answers.map((a) => {
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

  mappedAnswers.sort((x, y) => {
    const ox = qMap.get(x.questionId)?.order_index ?? 0
    const oy = qMap.get(y.questionId)?.order_index ?? 0
    return ox - oy
  })

  return {
    id: submission.id,
    examCode: submission.exams?.code ?? '',
    examTitle: submission.exams?.title ?? '',
    passMark: submission.exams?.pass_mark ?? 50,
    studentName: submission.students?.name ?? 'غير معروف',
    studentCode: submission.students?.code ?? '-',
    score: submission.score ?? 0,
    total: submission.total ?? 0,
    autoScore: submission.auto_score ?? 0,
    status: submission.status ?? '',
    gradingStatus: (submission.grading_status ?? 'graded') as 'graded' | 'pending',
    answers: mappedAnswers,
  }
}

export async function gradeSubmission(
  submissionId: string,
  manualGrades: { answerId: string; awardedPoints: number }[],
) {
  if (!(await hasResourceAccess('exams', 'manage'))) {
    return { success: false, error: 'غير مصرح لك' }
  }

  const submission = await prisma.exam_submissions.findUnique({
    where: { id: submissionId },
    select: { id: true, exam_id: true, total: true, exams: { select: { code: true, pass_mark: true } } }
  })
  if (!submission) return { success: false, error: 'التسليم غير موجود' }

  const answers = await prisma.exam_answers.findMany({
    where: { submission_id: submissionId },
    select: { id: true, question_id: true, awarded_points: true, needs_manual: true }
  })

  const questionIds = answers.map((a) => a.question_id)
  const questions = await prisma.exam_questions.findMany({
    where: { id: { in: questionIds.length ? questionIds : ['00000000-0000-0000-0000-000000000000'] } },
    select: { id: true, points: true }
  })

  const pointsMap = new Map(questions.map((q) => [q.id, q.points ?? 0]))
  const gradeMap = new Map(manualGrades.map((g) => [g.answerId, g.awardedPoints]))

  let autoScore = 0
  let manualScore = 0

  const updatePromises = []

  for (const a of answers) {
    const maxPoints = pointsMap.get(a.question_id) ?? 0
    if (a.needs_manual) {
      const raw = gradeMap.has(a.id)
        ? gradeMap.get(a.id)!
        : a.awarded_points ?? 0
      const awarded = Math.max(0, Math.min(maxPoints, Math.round(raw)))
      manualScore += awarded
      
      updatePromises.push(
        prisma.exam_answers.update({
          where: { id: a.id },
          data: { awarded_points: awarded, is_correct: awarded >= maxPoints }
        })
      )
    } else {
      autoScore += a.awarded_points ?? 0
    }
  }

  await Promise.all(updatePromises)

  const total = submission.total ?? 0
  const score = autoScore + manualScore
  const percent = total > 0 ? Math.round((score / total) * 100) : 0
  const passMark = submission.exams?.pass_mark ?? 50
  const status = percent >= passMark ? 'ناجح' : 'راسب'

  try {
    await prisma.exam_submissions.update({
      where: { id: submissionId },
      data: {
        auto_score: autoScore,
        manual_score: manualScore,
        score,
        status,
        grading_status: 'graded',
      }
    })

    const examCode = submission.exams?.code
    if (examCode) {
      revalidatePath(`/admin/exams/${examCode}`)
      revalidatePath(`/student/exams/${examCode}`)
    }
    logActivity({ action: 'update', resource: 'exams', targetId: submissionId, targetLabel: `تصحيح اختبار — النتيجة: ${score}/${total} (${status})` }).catch(() => {})
    revalidatePath('/student/exams')

    return { success: true, score, total, status }
  } catch (error: any) {
    return { success: false, error: 'تعذر حفظ الدرجات' }
  }
}

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
  if (!(await hasResourceAccess('exams', 'manage'))) {
    return { success: false, error: 'غير مصرح لك' }
  }

  try {
    await prisma.exams.update({
      where: { code: examCode },
      data: {
        ...(updates.title !== undefined && { title: updates.title.trim() }),
        ...(updates.course !== undefined && { course: updates.course.trim() }),
        ...(updates.description !== undefined && { description: updates.description.trim() || null }),
        ...(updates.duration !== undefined && { duration: updates.duration }),
        ...(updates.passMark !== undefined && { pass_mark: updates.passMark }),
        ...(updates.status !== undefined && { status: updates.status }),
      }
    })

    logActivity({ action: 'update', resource: 'exams', targetId: examCode, targetLabel: `تعديل اختبار: ${examCode}` }).catch(() => {})
    revalidatePath(`/admin/exams/${examCode}`)
    revalidatePath('/admin/exams')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: 'تعذّر تحديث الاختبار' }
  }
}
