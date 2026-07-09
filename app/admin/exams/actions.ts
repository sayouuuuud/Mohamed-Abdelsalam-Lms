'use server'

import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/audit-log'
import type { ExamRecord, ExamStatus } from '@/lib/exams-data'

// Shape sent from the exam builder (client) to be persisted.
export type StageWithBranches = {
  id: string
  title: string
  branches: { id: string; title: string }[]
}

// Stages with their branches, used to attribute an exam to a subject branch.
export async function getStagesWithBranches(): Promise<StageWithBranches[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stages')
    .select('id, title, sort_order, branches (id, title, sort_order)')
    .order('sort_order', { ascending: true })
  if (error || !data) {
    console.log('[v0] getStagesWithBranches error:', error?.message)
    return []
  }
  return data.map((s: any) => ({
    id: s.id,
    title: s.title,
    branches: (s.branches || [])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((b: any) => ({ id: b.id, title: b.title })),
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
    branchId?: string | null
  }
  questions: Array<{
    type: 'mcq' | 'essay' | 'file'
    contentMode: 'text' | 'image'
    text: string
    imageUrl: string
    points: number
    // MCQ
    options: { id: string; text: string }[]
    correctOptionId: string | null
    // Essay
    modelAnswer: string
  }>
  publish: boolean
}

function makeExamCode() {
  return `EX-${Date.now().toString(36).toUpperCase()}`
}

// Persists a new exam + its questions. MCQ correct answers are stored as the
// option *value* (matching the existing seeded data format).
export async function saveExam(payload: SaveExamPayload) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'exams', 'manage'))) {
    return { success: false, error: 'غير مصرح لك' }
  }

  const { meta, questions, publish } = payload

  const code = makeExamCode()
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .insert({
      code,
      title: meta.title.trim(),
      course: meta.course.trim() || null,
      description: meta.description.trim() || null,
      duration: meta.duration,
      pass_mark: meta.passMark,
      shuffle: meta.shuffle,
      branch_id: meta.branchId || null,
      questions: questions.length,
      participants: 0,
      avg_score: 0,
      status: publish ? 'منشور' : 'مسودة',
    })
    .select('id, code')
    .single()

  if (examError || !exam) {
    console.log('[v0] saveExam exam insert error:', examError?.message)
    return { success: false, error: 'تعذر حفظ الاختبار' }
  }

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
        options: q.type === 'mcq' ? q.options.map((o) => o.text) : null,
        correct_answer: correctValue,
        model_answer: q.type === 'essay' ? q.modelAnswer.trim() || null : null,
        points: q.points || 1,
        order_index: index,
      }
    })

    const { error: qError } = await supabase.from('exam_questions').insert(rows)
    if (qError) {
      console.log('[v0] saveExam questions insert error:', qError.message)
      // Roll back the exam so we don't leave an empty shell.
      await supabase.from('exams').delete().eq('id', exam.id)
      return { success: false, error: 'تعذر حفظ الأسئلة' }
    }
  }

  logActivity({ action: 'create', resource: 'exams', targetId: exam.code, targetLabel: `اختبار: ${meta.title.trim()}` }).catch(() => {})
  revalidatePath('/admin/exams')
  return { success: true, code: exam.code }
}

export async function getExams(): Promise<ExamRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exams')
    .select('*, exam_submissions(score, total)')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => {
    const d = new Date(row.created_at)
    const submissions = row.exam_submissions || []
    const participants = submissions.length
    let avgScore = 0
    if (participants > 0) {
      const sum = submissions.reduce((acc: number, sub: any) => acc + (sub.total > 0 ? (sub.score / sub.total) * 100 : 0), 0)
      avgScore = Math.round(sum / participants)
    }

    return {
      id: row.code,
      title: row.title,
      course: row.course,
      questions: row.questions,
      duration: row.duration,
      participants,
      avgScore,
      status: row.status as ExamStatus,
      createdAt: `${d.getDate()} ${d.toLocaleString('ar-EG', { month: 'long' })} ${d.getFullYear()}`
    }
  })
}

export async function getExamsStats() {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'exams'))) {
    return null
  }

  const { data: raw } = await supabase
    .from('exams')
    .select('id, status, created_at, exam_submissions(score, total)')

  if (!raw) return null

  const examsRaw = raw.map(e => {
    const submissions = e.exam_submissions || []
    const participants = submissions.length
    let avg_score = 0
    if (participants > 0) {
      const sum = submissions.reduce((acc: number, sub: any) => acc + (sub.total > 0 ? (sub.score / sub.total) * 100 : 0), 0)
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

  // Current window (All time)
  const totalThis = examsRaw.length
  const publishedThis = examsRaw.filter(e => e.status === 'منشور').length
  const participantsThis = examsRaw.reduce((acc, e) => acc + (e.participants || 0), 0)
  
  const examsWithScores = examsRaw.filter(e => e.participants && e.participants > 0)
  const avgScoreThis = examsWithScores.length > 0
    ? Math.round(examsWithScores.reduce((acc, e) => acc + (e.avg_score || 0), 0) / examsWithScores.length)
    : 0

  // Previous window (All time up to 30 days ago)
  const prevExams = examsRaw.filter(e => new Date(e.created_at) < thirtyDaysAgo)
  
  const totalPrev = prevExams.length
  const publishedPrev = prevExams.filter(e => e.status === 'منشور').length
  const participantsPrev = prevExams.reduce((acc, e) => acc + (e.participants || 0), 0)
  
  const prevExamsWithScores = prevExams.filter(e => e.participants && e.participants > 0)
  const avgScorePrev = prevExamsWithScores.length > 0
    ? Math.round(prevExamsWithScores.reduce((acc, e) => acc + (e.avg_score || 0), 0) / prevExamsWithScores.length)
    : 0

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 1000) / 10
  }

  // Note: For average score, we use absolute difference instead of percentage change.
  return {
    total: totalThis,
    totalChange: calcChange(totalThis, totalPrev),
    published: publishedThis,
    publishedChange: calcChange(publishedThis, publishedPrev),
    participants: participantsThis,
    participantsChange: calcChange(participantsThis, participantsPrev),
    avgScore: avgScoreThis,
    avgScoreChange: avgScoreThis - avgScorePrev // e.g. +2% or -5%
  }
}
