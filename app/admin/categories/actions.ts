'use server'

import { prisma } from '@/lib/prisma'
import { hasResourceAccess } from '@/lib/auth-guard'
import { logActivity } from '@/lib/audit-log'
import { revalidatePath } from 'next/cache'


export type AdminCourseLecture = {
  id: string
  slug: string
  title: string
  sortOrder: number
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
  termId: string | null
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

export type AdminTerm = {
  id: string
  stageId: string
  title: string
  price: number
  oldPrice: number | null
  sortOrder: number
}

export type TermInput = {
  stageId: string
  title: string
  price: number
  oldPrice: number | null
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
  termPrice: number
  termOldPrice: number | null
  terms: AdminTerm[]
  branches: AdminBranch[]
}

export type StageInput = {
  title: string
  subtitle: string
  idx: string
  rows: string[]
  image: string
  termPrice: number
  termOldPrice: number | null
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
  termId: string | null
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

export async function getCurriculumAdmin(): Promise<AdminStage[]> {
  const [stages, branches, courses, lectures, sections, terms] = await Promise.all([
    prisma.stages.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.branches.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.monthly_courses.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.lectures.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.monthly_course_sections.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.terms.findMany({ orderBy: { sort_order: 'asc' } })
  ])

  const termsByStage = new Map<string, AdminTerm[]>()
  for (const row of terms) {
    const list = termsByStage.get(row.stage_id) ?? []
    list.push({
      id: row.id,
      stageId: row.stage_id,
      title: row.title,
      price: Number(row.price ?? 0),
      oldPrice: row.old_price != null ? Number(row.old_price) : null,
      sortOrder: row.sort_order ?? 1,
    })
    termsByStage.set(row.stage_id, list)
  }

  const sectionsByCourse = new Map<string, AdminCourseSection[]>()
  for (const row of sections) {
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
  for (const row of lectures) {
    lectureCountByBranch.set(row.branch_id, (lectureCountByBranch.get(row.branch_id) ?? 0) + 1)
    if (row.monthly_course_id) {
      lectureCountByCourse.set(row.monthly_course_id, (lectureCountByCourse.get(row.monthly_course_id) ?? 0) + 1)
      const list = lecturesByCourse.get(row.monthly_course_id) ?? []
      list.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        sortOrder: row.course_sort_order ?? row.sort_order ?? 0,
        sectionId: row.monthly_course_section_id ?? null,
      })
      lecturesByCourse.set(row.monthly_course_id, list)
    }
  }

  for (const list of lecturesByCourse.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const coursesByBranch = new Map<string, AdminMonthlyCourse[]>()
  for (const row of courses) {
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
      termId: row.term_id ?? null,
      lectureCount: lectureCountByCourse.get(row.id) ?? 0,
      lectures: lecturesByCourse.get(row.id) ?? [],
      sections: sectionsByCourse.get(row.id) ?? [],
    })
    coursesByBranch.set(row.branch_id, list)
  }

  const branchesByStage = new Map<string, AdminBranch[]>()
  for (const row of branches) {
    const list = branchesByStage.get(row.stage_id) ?? []
    list.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description ?? '',
      image: row.image ?? '',
      topics: Array.isArray(row.topics) ? (row.topics as string[]) : [],
      sortOrder: row.sort_order,
      lectureCount: lectureCountByBranch.get(row.id) ?? 0,
      courses: coursesByBranch.get(row.id) ?? [],
    })
    branchesByStage.set(row.stage_id, list)
  }

  return stages.map((row) => ({
    id: row.id,
    slug: row.slug,
    idx: row.idx,
    title: row.title,
    subtitle: row.subtitle || '',
    rows: Array.isArray(row.rows) ? (row.rows as string[]) : [],
    image: row.image || '',
    sortOrder: row.sort_order,
    termPrice: Number(row.term_price ?? 0),
    termOldPrice: row.term_old_price != null ? Number(row.term_old_price) : null,
    terms: termsByStage.get(row.id) ?? [],
    branches: branchesByStage.get(row.id) ?? [],
  }))
}

export async function createStage(input: StageInput) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const count = await prisma.stages.count()
  const sortOrder = count + 1

  try {
    await prisma.stages.create({
      data: {
        slug: slugify(input.title),
        idx: input.idx,
        title: input.title,
        subtitle: input.subtitle,
        rows: input.rows,
        image: input.image || '/stages/sec-1.png',
        sort_order: sortOrder,
        term_price: input.termPrice ?? 0,
        term_old_price: input.termOldPrice ?? null,
      }
    })
    logActivity({ action: 'create', resource: 'categories', targetLabel: `مرحلة: ${input.title}` }).catch(() => {})
    revalidatePath('/categories')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إضافة المرحلة.' }
  }
}

export async function updateStage(id: string, input: StageInput) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  try {
    await prisma.stages.update({
      where: { id },
      data: {
        idx: input.idx,
        title: input.title,
        subtitle: input.subtitle,
        rows: input.rows,
        image: input.image,
        term_price: input.termPrice ?? 0,
        term_old_price: input.termOldPrice ?? null,
      }
    })
    logActivity({ action: 'update', resource: 'categories', targetId: id, targetLabel: `مرحلة: ${input.title}` }).catch(() => {})
    revalidatePath('/categories')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر تحديث المرحلة.' }
  }
}

export async function deleteStage(id: string) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  // await cleanupStageMedia(id).catch((e) => console.log('[v0] cleanupStageMedia error:', e))

  try {
    await prisma.stages.delete({ where: { id } })
    logActivity({ action: 'delete', resource: 'categories', targetId: id, targetLabel: `مرحلة ID: ${id}` }).catch(() => {})
    revalidatePath('/categories')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حذف المرحلة.' }
  }
}

export async function createBranch(input: BranchInput) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const count = await prisma.branches.count({ where: { stage_id: input.stageId } })
  const sortOrder = count + 1

  try {
    await prisma.branches.create({
      data: {
        stage_id: input.stageId,
        slug: slugify(input.title),
        title: input.title,
        description: input.description,
        image: input.image || '/lectures/alg-identities.png',
        topics: input.topics,
        sort_order: sortOrder,
      }
    })
    logActivity({ action: 'create', resource: 'categories', targetLabel: `فرع: ${input.title}` }).catch(() => {})
    revalidatePath('/categories')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إضافة الفرع.' }
  }
}

export async function updateBranch(id: string, input: Omit<BranchInput, 'stageId'>) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  try {
    await prisma.branches.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        image: input.image,
        topics: input.topics,
      }
    })
    logActivity({ action: 'update', resource: 'categories', targetId: id, targetLabel: `فرع: ${input.title}` }).catch(() => {})
    revalidatePath('/categories')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر تحديث الفرع.' }
  }
}

export async function deleteBranch(id: string) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  // await cleanupBranchMedia(id).catch((e) => console.log('[v0] cleanupBranchMedia error:', e))

  try {
    await prisma.branches.delete({ where: { id } })
    logActivity({ action: 'delete', resource: 'categories', targetId: id, targetLabel: `فرع ID: ${id}` }).catch(() => {})
    revalidatePath('/categories')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حذف الفرع.' }
  }
}

export async function createMonthlyCourse(input: MonthlyCourseInput) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const count = await prisma.monthly_courses.count({ where: { branch_id: input.branchId } })
  const sortOrder = count + 1

  try {
    await prisma.monthly_courses.create({
      data: {
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
        term_id: input.termId ?? null,
      }
    })
    logActivity({ action: 'create', resource: 'categories', targetLabel: `كورس: ${input.title}` }).catch(() => {})
    revalidatePath('/categories')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إضافة الكورس.' }
  }
}

export async function updateMonthlyCourse(id: string, input: Omit<MonthlyCourseInput, 'branchId'>) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  try {
    await prisma.monthly_courses.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        image: input.image || null,
        price: input.price,
        old_price: input.oldPrice,
        badge: input.badge || null,
        is_published: input.isPublished,
        term_id: input.termId ?? null,
        updated_at: new Date()
      }
    })
    logActivity({ action: 'update', resource: 'categories', targetId: id, targetLabel: `كورس: ${input.title}` }).catch(() => {})
    revalidatePath('/categories')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر تحديث الكورس.' }
  }
}

export async function deleteMonthlyCourse(id: string) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  // await cleanupCourseMedia(id).catch((e) => console.log('[v0] cleanupCourseMedia error:', e))

  try {
    await prisma.lectures.updateMany({
      where: { monthly_course_id: id },
      data: { monthly_course_id: null }
    })
    await prisma.monthly_courses.delete({ where: { id } })
    logActivity({ action: 'delete', resource: 'categories', targetId: id, targetLabel: `كورس ID: ${id}` }).catch(() => {})
    revalidatePath('/categories')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حذف الكورس.' }
  }
}

export async function createTerm(input: TermInput) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح.' }

  const count = await prisma.terms.count({ where: { stage_id: input.stageId } })

  try {
    await prisma.terms.create({
      data: {
        stage_id: input.stageId,
        title: input.title.trim(),
        price: input.price,
        old_price: input.oldPrice ?? null,
        sort_order: count + 1,
      }
    })
    logActivity({ action: 'create', resource: 'categories', targetLabel: `ترم: ${input.title}` }).catch(() => {})
    revalidatePath('/admin/categories')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إضافة الترم.' }
  }
}

export async function updateTerm(id: string, input: Omit<TermInput, 'stageId'>) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح.' }

  try {
    await prisma.terms.update({
      where: { id },
      data: {
        title: input.title.trim(),
        price: input.price,
        old_price: input.oldPrice ?? null,
      }
    })
    logActivity({ action: 'update', resource: 'categories', targetId: id, targetLabel: `ترم: ${input.title}` }).catch(() => {})
    revalidatePath('/admin/categories')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر تحديث الترم.' }
  }
}

export async function deleteTerm(id: string) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح.' }

  try {
    await prisma.monthly_courses.updateMany({
      where: { term_id: id },
      data: { term_id: null }
    })
    await prisma.terms.delete({ where: { id } })
    logActivity({ action: 'delete', resource: 'categories', targetId: id }).catch(() => {})
    revalidatePath('/admin/categories')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حذف الترم.' }
  }
}

export type CourseSectionInput = {
  courseId: string
  title: string
}

export async function createCourseSection(input: CourseSectionInput) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const title = input.title.trim()
  if (!title || !input.courseId) return { error: 'اكتب اسم التصنيف.' }

  const count = await prisma.monthly_course_sections.count({ where: { monthly_course_id: input.courseId } })

  try {
    await prisma.monthly_course_sections.create({
      data: {
        monthly_course_id: input.courseId,
        title,
        sort_order: count + 1,
      }
    })
    logActivity({ action: 'create', resource: 'categories', targetLabel: `تصنيف كورس: ${title}` }).catch(() => {})
    revalidatePath('/admin/categories')
    revalidatePath('/categories')
    revalidatePath('/student/browse')
    revalidatePath('/student/courses')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر إنشاء التصنيف.' }
  }
}

export async function updateCourseSection(id: string, input: { title: string }) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const title = input.title.trim()
  if (!title) return { error: 'اكتب اسم التصنيف.' }

  try {
    await prisma.monthly_course_sections.update({
      where: { id },
      data: { title }
    })
    revalidatePath('/admin/categories')
    revalidatePath('/categories')
    revalidatePath('/student/browse')
    revalidatePath('/student/courses')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر تحديث التصنيف.' }
  }
}

export async function deleteCourseSection(id: string) {
  if (!(await hasResourceAccess('categories', 'manage'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  try {
    await prisma.lectures.updateMany({
      where: { monthly_course_section_id: id },
      data: { monthly_course_section_id: null }
    })
    await prisma.monthly_course_sections.delete({ where: { id } })
    logActivity({ action: 'delete', resource: 'categories', targetId: id, targetLabel: `تصنيف كورس ID: ${id}` }).catch(() => {})
    revalidatePath('/admin/categories')
    revalidatePath('/categories')
    revalidatePath('/student/browse')
    revalidatePath('/student/courses')
    return { success: true }
  } catch (error: any) {
    return { error: 'تعذّر حذف التصنيف.' }
  }
}
