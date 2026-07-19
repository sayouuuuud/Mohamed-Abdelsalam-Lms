'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'

export type SearchResultItem = {
  id: string
  label: string
  sublabel?: string
  href: string
  type: 'student' | 'lecture' | 'course' | 'exam' | 'category'
}

export type GlobalSearchResults = {
  students: SearchResultItem[]
  lectures: SearchResultItem[]
  courses: SearchResultItem[]
  exams: SearchResultItem[]
  categories: SearchResultItem[]
}

export async function globalAdminSearch(q: string): Promise<GlobalSearchResults> {
  const empty: GlobalSearchResults = {
    students: [], lectures: [], courses: [], exams: [], categories: [],
  }

  if (!q || q.trim().length < 2) return empty

  if (!(await hasResourceAccess('students', 'view'))) return empty

  const term = `%${q.trim()}%`

  const [studentsRes, lecturesRes, coursesRes, examsRes, stagesRes, branchesRes] = await Promise.all([
    prisma.students.findMany({
      where: {
        OR: [
          { name: { contains: q.trim(), mode: 'insensitive' } },
          { email: { contains: q.trim(), mode: 'insensitive' } },
          { phone: { contains: q.trim(), mode: 'insensitive' } },
          { code: { contains: q.trim(), mode: 'insensitive' } },
        ]
      },
      select: { code: true, name: true, email: true, phone: true },
      take: 8
    }),
    prisma.lectures.findMany({
      where: { title: { contains: q.trim(), mode: 'insensitive' } },
      select: { id: true, title: true, branches: { select: { title: true, stages: { select: { title: true } } } } },
      take: 8
    }),
    prisma.monthly_courses.findMany({
      where: { title: { contains: q.trim(), mode: 'insensitive' } },
      select: { id: true, title: true, branches: { select: { title: true, stages: { select: { title: true } } } } },
      take: 8
    }),
    prisma.exams.findMany({
      where: { title: { contains: q.trim(), mode: 'insensitive' } },
      select: { id: true, title: true, status: true },
      take: 8
    }),
    prisma.stages.findMany({
      where: { title: { contains: q.trim(), mode: 'insensitive' } },
      select: { id: true, title: true },
      take: 5
    }),
    prisma.branches.findMany({
      where: { title: { contains: q.trim(), mode: 'insensitive' } },
      select: { id: true, title: true, stages: { select: { title: true } } },
      take: 5
    })
  ])

  const students: SearchResultItem[] = (studentsRes as any[]).map((r: any) => ({
    id: r.code,
    label: r.name || r.email,
    sublabel: r.email || r.phone,
    href: `/admin/students/${r.code}`,
    type: 'student',
  }))

  const lectures: SearchResultItem[] = (lecturesRes as any[]).map((r: any) => ({
    id: r.id,
    label: r.title,
    sublabel: [r.branches?.stages?.title, r.branches?.title].filter(Boolean).join(' · '),
    href: `/admin/courses`,
    type: 'lecture',
  }))

  const courses: SearchResultItem[] = (coursesRes as any[]).map((r: any) => ({
    id: r.id,
    label: r.title,
    sublabel: [r.branches?.stages?.title, r.branches?.title].filter(Boolean).join(' · '),
    href: `/admin/categories`,
    type: 'course',
  }))

  const exams: SearchResultItem[] = (examsRes as any[]).map((r: any) => ({
    id: r.id,
    label: r.title,
    sublabel: r.status === 'منشور' ? 'منشور' : 'مسودة',
    href: `/admin/exams`,
    type: 'exam',
  }))

  const categories: SearchResultItem[] = [
    ...(stagesRes as any[]).map((r: any): SearchResultItem => ({
      id: r.id,
      label: r.title,
      sublabel: 'مرحلة دراسية',
      href: `/admin/categories`,
      type: 'category',
    })),
    ...(branchesRes as any[]).map((r: any): SearchResultItem => ({
      id: r.id,
      label: r.title,
      sublabel: r.stages?.title || 'فرع',
      href: `/admin/categories`,
      type: 'category',
    })),
  ]

  return { students, lectures, courses, exams, categories }
}
