'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit-log'
import type { ExamRecord, ExamStatus } from '@/lib/exams-data'

export type StageWithBranches = {
  id: string
  title: string
  branches: { id: string; title: string }[]
}

export async function getStagesWithBranches(): Promise<StageWithBranches[]> {
  const data = await prisma.stages.findMany({
    select: { id: true, title: true, sort_order: true, branches: { select: { id: true, title: true, sort_order: true }, orderBy: { sort_order: 'asc' } } },
    orderBy: { sort_order: 'asc' }
  })

  return data.map((s) => ({
    id: s.id,
    title: s.title,
    branches: s.branches.map((b) => ({ id: b.id, title: b.title })),
  }))
}

export type SaveExamPayload = {
  meta: {
    title: string
    course: string
    description: string
    duration: number
    passMark: number
    shuffle: boolean
    stageId?: string | null
    branchId?: string | null
  }
  questions: Array<{
    type: 'mcq' | 'essay' | 'file'
    contentMode: 'text' | 'image'
    text: string
    imageUrl: string
    points: number
    options: { id: string; text: string }[]
    correctOptionId: string | null
    modelAnswer: string
  }>
  publish: boolean
}

function makeExamCode() {
  return `EX-${Date.now().toString(36).toUpperCase()}`
}

export async function saveExam(payload: SaveExamPayload) {
  if (!(await hasResourceAccess('exams', 'manage'))) {
    return { success: false, error: 'غير مصرح لك' }
  }

  const { meta, questions, publish } = payload
  const code = makeExamCode()

  try {
    const exam = await prisma.exams.create({
      data: {
        code,
        title: meta.title.trim(),
        course: meta.course.trim(),
        description: meta.description.trim() || null,
        duration: meta.duration,
        pass_mark: meta.passMark,
        shuffle: meta.shuffle,
        stage_id: meta.stageId || null,
        branch_id: meta.branchId || null,
        questions: questions.length,
        status: publish ? 'منشور' : 'مسودة',
      },
      select: { id: true, code: true }
    })

    if (questions.length > 0) {
      const rows = questions.map((q, index) => {
        const correctValue =
          q.type === 'mcq'
            ? (q.options.find((o) => o.id === q.correctOptionId)?.text ?? null)
            : null

        return {
          exam_id: exam.id,
          question_text: q.text.trim(),
          question_type: q.type,
          content_mode: q.contentMode,
          image_url: q.contentMode === 'image' ? q.imageUrl : null,
          options: q.type === 'mcq' ? q.options.map((o) => o.text) : [],
          correct_answer: correctValue,
          model_answer: q.type === 'essay' ? q.modelAnswer.trim() || null : null,
          points: q.points || 1,
          order_index: index,
        }
      })

      await prisma.exam_questions.createMany({ data: rows })
    }

    logActivity({ action: 'create', resource: 'exams', targetId: exam.code, targetLabel: `اختبار: ${meta.title.trim()}` }).catch(() => {})
    revalidatePath('/admin/exams')
    return { success: true, code: exam.code }
  } catch (error: any) {
    return { success: false, error: 'تعذر حفظ الاختبار أو الأسئلة' }
  }
}

export async function getExams(): Promise<ExamRecord[]> {
  const data = await prisma.exams.findMany({
    include: { exam_submissions: { select: { score: true, total: true } } },
    orderBy: { created_at: 'desc' }
  })

  return data.map((row) => {
    const d = new Date(row.created_at)
    const submissions = row.exam_submissions || []
    const participants = submissions.length
    let avgScore = 0
    if (participants > 0) {
      const sum = submissions.reduce((acc, sub) => acc + (sub.total > 0 ? (sub.score / sub.total) * 100 : 0), 0)
      avgScore = Math.round(sum / participants)
    }

    return {
      id: row.code,
      title: row.title,
      course: row.course || '',
      questions: row.questions ?? 0,
      duration: row.duration ?? 0,
      participants,
      avgScore,
      status: row.status as ExamStatus,
      createdAt: `${d.getDate()} ${d.toLocaleString('ar-EG', { month: 'long' })} ${d.getFullYear()}`
    }
  })
}

export async function getExamsStats() {
  if (!(await hasResourceAccess('exams'))) {
    return null
  }

  const raw = await prisma.exams.findMany({
    select: { id: true, status: true, created_at: true, exam_submissions: { select: { score: true, total: true } } }
  })

  const examsRaw = raw.map((e) => {
    const submissions = e.exam_submissions || []
    const participants = submissions.length
    let avg_score = 0
    if (participants > 0) {
      const sum = submissions.reduce((acc, sub) => acc + (sub.total > 0 ? (sub.score / sub.total) * 100 : 0), 0)
      avg_score = Math.round(sum / participants)
    }
    return {
      id: e.id,
      status: e.status,
      created_at: e.created_at,
      participants,
      avg_score
    }
  })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const totalThis = examsRaw.length
  const publishedThis = examsRaw.filter((e) => e.status === 'منشور').length
  const participantsThis = examsRaw.reduce((acc, e) => acc + (e.participants || 0), 0)

  const examsWithScores = examsRaw.filter((e) => e.participants && e.participants > 0)
  const avgScoreThis = examsWithScores.length > 0
    ? Math.round(examsWithScores.reduce((acc, e) => acc + (e.avg_score || 0), 0) / examsWithScores.length)
    : 0

  const prevExams = examsRaw.filter((e) => new Date(e.created_at) < thirtyDaysAgo)

  const totalPrev = prevExams.length
  const publishedPrev = prevExams.filter((e) => e.status === 'منشور').length
  const participantsPrev = prevExams.reduce((acc, e) => acc + (e.participants || 0), 0)

  const prevExamsWithScores = prevExams.filter((e) => e.participants && e.participants > 0)
  const avgScorePrev = prevExamsWithScores.length > 0
    ? Math.round(prevExamsWithScores.reduce((acc, e) => acc + (e.avg_score || 0), 0) / prevExamsWithScores.length)
    : 0

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 1000) / 10
  }

  return {
    total: totalThis,
    totalChange: calcChange(totalThis, totalPrev),
    published: publishedThis,
    publishedChange: calcChange(publishedThis, publishedPrev),
    participants: participantsThis,
    participantsChange: calcChange(participantsThis, participantsPrev),
    avgScore: avgScoreThis,
    avgScoreChange: avgScoreThis - avgScorePrev
  }
}
