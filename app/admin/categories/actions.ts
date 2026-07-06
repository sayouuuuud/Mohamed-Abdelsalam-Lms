'use server'

import { createClient } from '@/lib/supabase/server'
import { hasResourceAccess } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'

// ── Admin-facing types (use the real uuid `id`) ───────────────────
export type AdminBranch = {
  id: string
  slug: string
  title: string
  description: string
  image: string
  topics: string[]
  sortOrder: number
  lectureCount: number
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

  const [stagesRes, branchesRes, lecturesRes] = await Promise.all([
    supabase
      .from('stages')
      .select('id, slug, idx, title, subtitle, rows, image, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('branches')
      .select('id, stage_id, slug, title, description, image, topics, sort_order')
      .order('sort_order', { ascending: true }),
    supabase.from('lectures').select('id, branch_id'),
  ])

  if (stagesRes.error || !stagesRes.data) {
    console.log('[v0] getCurriculumAdmin error:', stagesRes.error?.message)
    return []
  }

  const lectureCountByBranch = new Map<string, number>()
  for (const row of lecturesRes.data ?? []) {
    lectureCountByBranch.set(
      row.branch_id,
      (lectureCountByBranch.get(row.branch_id) ?? 0) + 1,
    )
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
  if (!(await hasResourceAccess(supabase, 'categories'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

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
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function updateStage(id: string, input: StageInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

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
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function deleteStage(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase.from('stages').delete().eq('id', id)
  if (error) {
    console.log('[v0] deleteStage error:', error.message)
    return { error: 'تعذّر حذف المرحلة.' }
  }
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

// ── Branch CRUD ───────────────────────────────────────────────────
export async function createBranch(input: BranchInput) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

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
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function updateBranch(
  id: string,
  input: Omit<BranchInput, 'stageId'>,
) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

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
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function deleteBranch(id: string) {
  const supabase = await createClient()
  if (!(await hasResourceAccess(supabase, 'categories'))) return { error: 'غير مسموح. لازم تكون أدمن.' }

  const { error } = await supabase.from('branches').delete().eq('id', id)
  if (error) {
    console.log('[v0] deleteBranch error:', error.message)
    return { error: 'تعذّر حذف الفرع.' }
  }
  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}
