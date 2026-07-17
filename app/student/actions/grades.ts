'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentStudent } from '@/lib/auth-guard'
import type { GradeItem } from '@/lib/student-types'

export async function getStudentRecentGrades() {
  const student = await getCurrentStudent()
  if (!student) return []

  const asgSubs = await prisma.assignment_submissions.findMany({
    where: {
      student_id: student.id,
      status: 'مصحّح'
    },
    select: {
      id: true,
      score: true,
      submitted_at: true,
      assignments: {
        select: {
          title: true,
          points: true,
          lecture_id: true,
          lectures: { select: { title: true } }
        }
      }
    },
    orderBy: { submitted_at: 'desc' },
    take: 5
  })

  const examSubs = await prisma.exam_submissions.findMany({
    where: {
      student_id: student.id,
      grading_status: 'graded'
    },
    select: {
      id: true,
      score: true,
      total: true,
      submitted_at: true,
      grading_status: true,
      exams: {
        select: {
          title: true,
          course: true
        }
      }
    },
    orderBy: { submitted_at: 'desc' },
    take: 5
  })

  const grades: GradeItem[] = []

  for (const s of asgSubs) {
    const asg = s.assignments
    grades.push({
      id: s.id,
      title: asg?.title ?? '—',
      course: asg?.lectures?.title ?? 'عام',
      score: s.score ?? 0,
      total: asg?.points ?? 0,
      date: s.submitted_at ? s.submitted_at.toLocaleDateString('ar-EG') : '',
    })
  }

  for (const s of examSubs) {
    const ex = s.exams
    grades.push({
      id: s.id,
      title: ex?.title ?? '—',
      course: ex?.course ?? 'عام',
      score: s.score ?? 0,
      total: s.total ?? 0,
      date: s.submitted_at ? s.submitted_at.toLocaleDateString('ar-EG') : '',
    })
  }

  return grades
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 5)
}

export async function getStudentCertificates() {
  const student = await getCurrentStudent()
  if (!student) return []

  const certs = await prisma.certificates.findMany({
    where: { student_id: student.id },
    orderBy: { issued_at: 'desc' }
  })

  return certs.map((c) => ({
    id: c.id,
    title: c.title,
    issuer: c.issuer,
    date: c.issued_at.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })
  }))
}
