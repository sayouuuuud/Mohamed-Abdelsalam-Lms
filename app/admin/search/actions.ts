'use server'

import { createClient } from '@/lib/supabase/server'
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

  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'students', 'view'))) return empty

  const term = `%${q.trim()}%`

  const [studentsRes, lecturesRes, coursesRes, examsRes, stagesRes, branchesRes] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
        .eq('role', 'student')
        .limit(8),
      supabase
        .from('lectures')
        .select('id, slug, title, branch_id, branches:branch_id(title, stages:stage_id(title))')
        .ilike('title', term)
        .limit(8),
      supabase
        .from('monthly_courses')
        .select('id, slug, title, branch_id, branches:branch_id(title, stages:stage_id(title))')
        .ilike('title', term)
        .limit(8),
      supabase
        .from('exams')
        .select('id, title, status')
        .ilike('title', term)
        .limit(8),
      supabase
        .from('stages')
        .select('id, slug, title')
        .ilike('title', term)
        .limit(5),
      supabase
        .from('branches')
        .select('id, slug, title, stage_id, stages:stage_id(title)')
        .ilike('title', term)
        .limit(5),
    ])

  const students: SearchResultItem[] = (studentsRes.data ?? []).map((r: any) => ({
    id: r.id,
    label: r.full_name || r.email,
    sublabel: r.email,
    href: `/admin/students?q=${encodeURIComponent(r.email || r.full_name)}`,
    type: 'student',
  }))

  const lectures: SearchResultItem[] = (lecturesRes.data ?? []).map((r: any) => ({
    id: r.id,
    label: r.title,
    sublabel: [r.branches?.stages?.title, r.branches?.title].filter(Boolean).join(' · '),
    href: `/admin/courses`,
    type: 'lecture',
  }))

  const courses: SearchResultItem[] = (coursesRes.data ?? []).map((r: any) => ({
    id: r.id,
    label: r.title,
    sublabel: [r.branches?.stages?.title, r.branches?.title].filter(Boolean).join(' · '),
    href: `/admin/categories`,
    type: 'course',
  }))

  const exams: SearchResultItem[] = (examsRes.data ?? []).map((r: any) => ({
    id: r.id,
    label: r.title,
    sublabel: r.status === 'منشور' ? 'منشور' : 'مسودة',
    href: `/admin/exams`,
    type: 'exam',
  }))

  const categories: SearchResultItem[] = [
    ...(stagesRes.data ?? []).map((r: any): SearchResultItem => ({
      id: r.id,
      label: r.title,
      sublabel: 'مرحلة دراسية',
      href: `/admin/categories`,
      type: 'category',
    })),
    ...(branchesRes.data ?? []).map((r: any): SearchResultItem => ({
      id: r.id,
      label: r.title,
      sublabel: (r.stages as any)?.title || 'فرع',
      href: `/admin/categories`,
      type: 'category',
    })),
  ]

  return { students, lectures, courses, exams, categories }
}
