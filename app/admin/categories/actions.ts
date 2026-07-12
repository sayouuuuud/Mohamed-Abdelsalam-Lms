'use server'

import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import { revalidatePath } from 'next/cache'

// ── Admin-facing types (use the real uuid `id`) ───────────────────
export type AdminCourseLecture = {
  id: string
  slug: string
  title: string
  sortOrder: number
  // التصنيف اللي المحاضرة تابعة له داخل الكورس (null = بدون تصنيف)
  sectionId: string | null
}

export type AdminCourseSection = {
  id: string
  courseId: string
  title: string
  sortOrder: number
}

export type AdminMonthlyCourse = {
  id: string
  branchId: string
  slug: string
  title: string
  description: string
  image: string
  price: number
  oldPrice: number | null
  badge: string
  isPublished: boolean
  sortOrder: number
  lectureCount: number
  lectures: AdminCourseLecture[]
  sections: AdminCourseSection[]
}

export type AdminBranch = {
  id: string
  slug: string
  title: string
  description: string
  image: string
  topics: string[]
  sortOrder: number
  lectureCount: number
  courses: AdminMonthlyCourse[]
}

export type AdminStage = {
  id: string
  slug: string
  idx: string
  title: string
  subtitle: string
  rows: string[]
  image: string
  sortOrder: number
  branches: AdminBranch[]
}

export type StageInput = {
  title: string
  subtitle: string
  idx: string
  rows: string[]
  image: string
}

export type BranchInput = {
  stageId: string
  title: string
  description: string
  topics: string[]
  image: string
}

export type MonthlyCourseInput = {
  branchId: string
  title: string
  description: string
  image: string
  price: number
  oldPrice: number | null
  badge: string
  isPublished: boolean
}

function slugify(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base ? base.slice(0, 24) : 'item'}-${suffix}`
}

// ── Read: full stages → branches tree with counts ─────────────────
export async function getCurriculumAdmin(): Promise<AdminStage[]> {
  const supabase = await createClient()

  const [stagesRes, branchesRes, coursesRes, lecturesRes, sectionsRes] = await Promise.all([
    supabase
      .from('stages')
      .select('id, slug, idx, title, subtitle, rows, image, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('branches')
      .select('id, stage_id, slug, title, description, image, topics, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('monthly_courses')
      .select('id, branch_id, slug, title, description, image, price, old_price, badge, is_published, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('lectures')
      .select('id, slug, title, branch_id, monthly_course_id, monthly_course_section_id, course_sort_order, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('monthly_course_sections')
      .select('id, monthly_course_id, title, sort_order')
      .order('sort_order', { ascending: true }),
  ])

  if (stagesRes.error || !stagesRes.data) {
    console.log('[v0] getCurriculumAdmin error:', stagesRes.error?.message)
    return []
  }

  // Sections grouped per course (best-effort: table may not exist pre-migration).
  const sectionsByCourse = new Map<string, AdminCourseSection[]>()
  for (const row of sectionsRes.data ?? []) {
    const list = sectionsByCourse.get(row.monthly_course_id) ?? []
    list.push({
      id: row.id,
      courseId: row.monthly_course_id,
      title: row.title,
      sortOrder: row.sort_order ?? 0,
    })
    sectionsByCourse.set(row.monthly_course_id, list)
  }

  const lectureCountByBranch = new Map<string, number>()
  const lectureCountByCourse = new Map<string, number>()
  const lecturesByCourse = new Map<string, AdminCourseLecture[]>()
  for (const row of lecturesRes.data ?? []) {
    lectureCountByBranch.set(
      row.branch_id,
      (lectureCountByBranch.get(row.branch_id) ?? 0) + 1,
    )
    if (row.monthly_course_id) {
      lectureCountByCourse.set(
        row.monthly_course_id,
        (lectureCountByCourse.get(row.monthly_course_id) ?? 0) + 1,
      )
      const list = lecturesByCourse.get(row.monthly_course_id) ?? []
      list.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        sortOrder: row.course_sort_order ?? row.sort_order ?? 0,
        sectionId: (row as any).monthly_course_section_id ?? null,
      })
      lecturesByCourse.set(row.monthly_course_id, list)
    }
  }

  // Order each course's lectures by their position within the course.
  for (const list of lecturesByCourse.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const coursesByBranch = new Map<string, AdminMonthlyCourse[]>()
  for (const row of coursesRes.data ?? []) {
    const list = coursesByBranch.get(row.branch_id) ?? []
    list.push({
      id: row.id,
      branchId: row.branch_id,
      slug: row.slug,
      title: row.title,
      description: row.description ?? '',
      image: row.image ?? '',
      price: Number(row.price ?? 0),
      oldPrice: row.old_price != null ? Number(row.old_price) : null,
      badge: row.badge ?? '',
      isPublished: !!row.is_published,
      sortOrder: row.sort_order,
      lectureCount: lectureCountByCourse.get(row.id) ?? 0,
      lectures: lecturesByCourse.get(row.id) ?? [],
      sections: sectionsByCourse.get(row.id) ?? [],
    })
    coursesByBranch.set(row.branch_id, list)
  }

  const branchesByStage = new Map<string, AdminBranch[]>()
  for (const row of branchesRes.data ?? []) {
    const list = branchesByStage.get(row.stage_id) ?? []
    list.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      image: row.image,
      topics: row.topics ?? [],
      sortOrder: row.sort_order,
      lectureCount: lectureCountByBranch.get(row.id) ?? 0,
      courses: coursesByBranch.get(row.id) ?? [],
    })
    branchesByStage.set(row.stage_id, list)
  }

  return stagesRes.data.map((row) => ({
    id: row.id,
    slug: row.slug,
    idx: row.idx,
    title: row.title,
    subtitle: row.subtitle,
    rows: row.rows ?? [],
    image: row.image,
    sortOrder: row.sort_order,
    branches: branchesByStage.get(row.id) ?? [],
  }))
}

// ── Stage CRUD ────────────────────────────────────────────────────
export async function createStage(input: StageInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { count } = await supabase
    .from('stages')
    .select('id', { count: 'exact', head: true })
  const sortOrder = (count ?? 0) + 1

  const { error } = await supabase.from('stages').insert({
    slug: slugify(input.title),
    idx: input.idx,
    title: input.title,
    subtitle: input.subtitle,
    rows: input.rows,
    image: input.image || '/stages/sec-1.png',
    sort_order: sortOrder,
  })

  if (error) {
    console.log('[v0] createStage error:', error.message)
    return { error: 'تعذّر إضافة المرحلة.' }
  }
  logActivity({ action: 'create', resource: 'categories', targetLabel: `مرحلة: ${input.title}` }).catch(() => {})
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function updateStage(id: string, input: StageInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase
    .from('stages')
    .update({
      idx: input.idx,
      title: input.title,
      subtitle: input.subtitle,
      rows: input.rows,
      image: input.image,
    })
    .eq('id', id)

  if (error) {
    console.log('[v0] updateStage error:', error.message)
    return { error: 'تعذّر تحديث المرحلة.' }
  }
  logActivity({ action: 'update', resource: 'categories', targetId: id, targetLabel: `مرحلة: ${input.title}` }).catch(() => {})
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function deleteStage(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase.from('stages').delete().eq('id', id)
  if (error) {
    console.log('[v0] deleteStage error:', error.message)
    return { error: 'تعذّر حذف المرحل��.' }
  }
  logActivity({ action: 'delete', resource: 'categories', targetId: id, targetLabel: `مرحلة ID: ${id}` }).catch(() => {})
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

// ── Branch CRUD ───────────────────────────────────────────────────
export async function createBranch(input: BranchInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { count } = await supabase
    .from('branches')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', input.stageId)
  const sortOrder = (count ?? 0) + 1

  const { error } = await supabase.from('branches').insert({
    stage_id: input.stageId,
    slug: slugify(input.title),
    title: input.title,
    description: input.description,
    image: input.image || '/lectures/alg-identities.png',
    topics: input.topics,
    sort_order: sortOrder,
  })

  if (error) {
    console.log('[v0] createBranch error:', error.message)
    return { error: 'تعذّر إضافة الفرع.' }
  }
  logActivity({ action: 'create', resource: 'categories', targetLabel: `فرع: ${input.title}` }).catch(() => {})
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function updateBranch(
  id: string,
  input: Omit<BranchInput, 'stageId'>,
) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase
    .from('branches')
    .update({
      title: input.title,
      description: input.description,
      image: input.image,
      topics: input.topics,
    })
    .eq('id', id)

  if (error) {
    console.log('[v0] updateBranch error:', error.message)
    return { error: 'تعذّر تحديث الفرع.' }
  }
  logActivity({ action: 'update', resource: 'categories', targetId: id, targetLabel: `فرع: ${input.title}` }).catch(() => {})
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function deleteBranch(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase.from('branches').delete().eq('id', id)
  if (error) {
    console.log('[v0] deleteBranch error:', error.message)
    return { error: 'تعذّر حذف الفرع.' }
  }
  logActivity({ action: 'delete', resource: 'categories', targetId: id, targetLabel: `فرع ID: ${id}` }).catch(() => {})
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

// ── Monthly course CRUD ───────────────────────────────────────────
export async function createMonthlyCourse(input: MonthlyCourseInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { count } = await supabase
    .from('monthly_courses')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', input.branchId)
  const sortOrder = (count ?? 0) + 1

  const { error } = await supabase.from('monthly_courses').insert({
    branch_id: input.branchId,
    slug: slugify(input.title),
    title: input.title,
    description: input.description,
    image: input.image || null,
    price: input.price,
    old_price: input.oldPrice,
    badge: input.badge || null,
    is_published: input.isPublished,
    sort_order: sortOrder,
  })

  if (error) {
    console.log('[v0] createMonthlyCourse error:', error.message)
    return { error: 'تعذّر إضافة الكورس.' }
  }
  logActivity({ action: 'create', resource: 'categories', targetLabel: `كورس: ${input.title}` }).catch(() => {})
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function updateMonthlyCourse(
  id: string,
  input: Omit<MonthlyCourseInput, 'branchId'>,
) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase
    .from('monthly_courses')
    .update({
      title: input.title,
      description: input.description,
      image: input.image || null,
      price: input.price,
      old_price: input.oldPrice,
      badge: input.badge || null,
      is_published: input.isPublished,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.log('[v0] updateMonthlyCourse error:', error.message)
    return { error: 'تعذّر تحديث الكورس.' }
  }
  logActivity({ action: 'update', resource: 'categories', targetId: id, targetLabel: `كورس: ${input.title}` }).catch(() => {})
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function deleteMonthlyCourse(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  // Detach lectures first (keep them, just unlink from the course)
  await supabase.from('lectures').update({ monthly_course_id: null }).eq('monthly_course_id', id)

  const { error } = await supabase.from('monthly_courses').delete().eq('id', id)
  if (error) {
    console.log('[v0] deleteMonthlyCourse error:', error.message)
    return { error: 'تعذّر حذف الكورس.' }
  }
  logActivity({ action: 'delete', resource: 'categories', targetId: id, targetLabel: `كورس ID: ${id}` }).catch(() => {})
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
  }

// ── Course sections CRUD (تصنيفات داخل الكورس) ────────────────────
export type CourseSectionInput = {
  courseId: string
  title: string
}

export async function createCourseSection(input: CourseSectionInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const title = input.title.trim()
  if (!title || !input.courseId) return { error: 'اكتب اسم التصنيف.' }

  const { count } = await supabase
    .from('monthly_course_sections')
    .select('id', { count: 'exact', head: true })
    .eq('monthly_course_id', input.courseId)

  const { error } = await supabase.from('monthly_course_sections').insert({
    monthly_course_id: input.courseId,
    title,
    sort_order: (count ?? 0) + 1,
  })

  if (error) {
    console.log('[v0] createCourseSection error:', error.message)
    return { error: 'تعذّر إنشاء التصنيف.' }
  }
  logActivity({ action: 'create', resource: 'categories', targetLabel: `تصنيف كورس: ${title}` }).catch(() => {})
  revalidatePath('/admin/categories')
  revalidatePath('/categories')
  revalidatePath('/student/browse')
  revalidatePath('/student/courses')
  return { success: true }
}

export async function updateCourseSection(id: string, input: { title: string }) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const title = input.title.trim()
  if (!title) return { error: 'اكتب اسم التصنيف.' }

  const { error } = await supabase.from('monthly_course_sections').update({ title }).eq('id', id)
  if (error) {
    console.log('[v0] updateCourseSection error:', error.message)
    return { error: 'تعذّر تحديث التصنيف.' }
  }
  revalidatePath('/admin/categories')
  revalidatePath('/categories')
  revalidatePath('/student/browse')
  revalidatePath('/student/courses')
  return { success: true }
}

export async function deleteCourseSection(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  // Detach lectures from the section first (keep them in the course).
  await supabase.from('lectures').update({ monthly_course_section_id: null }).eq('monthly_course_section_id', id)

  const { error } = await supabase.from('monthly_course_sections').delete().eq('id', id)
  if (error) {
    console.log('[v0] deleteCourseSection error:', error.message)
    return { error: 'تعذّر حذف التصنيف.' }
  }
  logActivity({ action: 'delete', resource: 'categories', targetId: id, targetLabel: `تصنيف كورس ID: ${id}` }).catch(() => {})
  revalidatePath('/admin/categories')
  revalidatePath('/categories')
  revalidatePath('/student/browse')
  revalidatePath('/student/courses')
  return { success: true }
}
