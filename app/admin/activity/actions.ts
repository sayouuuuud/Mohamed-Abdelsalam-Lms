'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-guard'
import { revalidatePath } from 'next/cache'

export type ActionType = 'create' | 'update' | 'delete' | 'approve' | 'reject'

export type ActivityLog = {
  id: string
  actor_id: string
  actor_name: string
  actor_role: 'admin' | 'assistant'
  action: ActionType
  resource: string
  target_id: string | null
  target_label: string | null
  created_at: string
}

export type AuthLog = {
  id: string
  actor_id: string
  actor_name: string
  actor_role: 'admin' | 'assistant'
  event: 'login' | 'logout'
  ip: string | null
  user_agent: string | null
  created_at: string
}

export type ActivityStats = {
  todayCount: number
  totalActors: number
  lastEventAt: string | null
  activeAssistants: number
}

export type ActorOption = {
  id: string
  name: string
  role: 'admin' | 'assistant'
}

export type ActivityFilters = {
  actorId?: string
  resource?: string
  action?: string
  from?: string
  to?: string
  page?: number
}

export type AuthFilters = {
  actorId?: string
  event?: string
  from?: string
  to?: string
  page?: number
}

const PAGE_SIZE = 50

export async function getActivityLogs(filters: ActivityFilters = {}): Promise<{
  logs: ActivityLog[]
  total: number
}> {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) return { logs: [], total: 0 }

  const page = filters.page ?? 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.actorId) query = query.eq('actor_id', filters.actorId)
  if (filters.resource) query = query.eq('resource', filters.resource)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lte('created_at', filters.to)

  const { data, count } = await query
  return { logs: (data ?? []) as ActivityLog[], total: count ?? 0 }
}

export async function getAuthLogs(filters: AuthFilters = {}): Promise<{
  logs: AuthLog[]
  total: number
}> {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) return { logs: [], total: 0 }

  const page = filters.page ?? 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('auth_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.actorId) query = query.eq('actor_id', filters.actorId)
  if (filters.event) query = query.eq('event', filters.event)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lte('created_at', filters.to)

  const { data, count } = await query
  return { logs: (data ?? []) as AuthLog[], total: count ?? 0 }
}

export async function getActivityStats(): Promise<ActivityStats> {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return { todayCount: 0, totalActors: 0, lastEventAt: null, activeAssistants: 0 }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [todayRes, lastRes, actorsRes, assistantsRes] = await Promise.all([
    supabase
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('activity_logs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('activity_logs')
      .select('actor_id'),
    supabase
      .from('auth_logs')
      .select('actor_id')
      .eq('event', 'login')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const uniqueActors = new Set((actorsRes.data ?? []).map((r: any) => r.actor_id)).size
  const activeAssistants = new Set((assistantsRes.data ?? []).map((r: any) => r.actor_id)).size

  return {
    todayCount: todayRes.count ?? 0,
    totalActors: uniqueActors,
    lastEventAt: lastRes.data?.created_at ?? null,
    activeAssistants,
  }
}

export async function getActorsList(): Promise<ActorOption[]> {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) return []

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['admin', 'assistant'])
    .order('full_name')

  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.full_name ?? 'غير معروف',
    role: p.role,
  }))
}
