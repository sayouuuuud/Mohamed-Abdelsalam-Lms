'use server'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'

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

const PAGE_SIZE = 10

export async function getActivityLogs(filters: ActivityFilters = {}): Promise<{
  logs: ActivityLog[]
  total: number
}> {
  if (!(await requireAdmin())) return { logs: [], total: 0 }

  const page = filters.page ?? 1
  const skip = (page - 1) * PAGE_SIZE

  const where: any = {}
  if (filters.actorId) where.actor_id = filters.actorId
  if (filters.resource) where.resource = filters.resource
  if (filters.action) where.action = filters.action
  if (filters.from || filters.to) {
    where.created_at = {}
    if (filters.from) where.created_at.gte = new Date(filters.from)
    if (filters.to) where.created_at.lte = new Date(filters.to)
  }

  const [total, data] = await Promise.all([
    prisma.activity_logs.count({ where }),
    prisma.activity_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: PAGE_SIZE
    })
  ])

  return {
    logs: data.map(d => ({
      ...d,
      actor_id: d.actor_id || '',
      created_at: d.created_at.toISOString(),
      action: d.action as ActionType,
      actor_role: d.actor_role as 'admin' | 'assistant'
    })),
    total
  }
}

export async function getAuthLogs(filters: AuthFilters = {}): Promise<{
  logs: AuthLog[]
  total: number
}> {
  if (!(await requireAdmin())) return { logs: [], total: 0 }

  const page = filters.page ?? 1
  const skip = (page - 1) * PAGE_SIZE

  const where: any = {}
  if (filters.actorId) where.actor_id = filters.actorId
  if (filters.event) where.event = filters.event
  if (filters.from || filters.to) {
    where.created_at = {}
    if (filters.from) where.created_at.gte = new Date(filters.from)
    if (filters.to) where.created_at.lte = new Date(filters.to)
  }

  const [total, data] = await Promise.all([
    prisma.auth_logs.count({ where }),
    prisma.auth_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: PAGE_SIZE
    })
  ])

  return {
    logs: data.map(d => ({
      ...d,
      actor_id: d.actor_id || '',
      created_at: d.created_at.toISOString(),
      event: d.event as 'login' | 'logout',
      actor_role: d.actor_role as 'admin' | 'assistant'
    })),
    total
  }
}

export async function getActivityStats(): Promise<ActivityStats> {
  if (!(await requireAdmin())) {
    return { todayCount: 0, totalActors: 0, lastEventAt: null, activeAssistants: 0 }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [todayCount, lastEvent, actorsQuery, assistantsRes] = await Promise.all([
    prisma.activity_logs.count({
      where: { created_at: { gte: todayStart } }
    }),
    prisma.activity_logs.findFirst({
      select: { created_at: true },
      orderBy: { created_at: 'desc' }
    }),
    prisma.$queryRaw`SELECT count_distinct_actors()`,
    prisma.auth_logs.findMany({
      where: {
        event: 'login',
        actor_role: 'assistant',
        created_at: { gte: sevenDaysAgo }
      },
      select: { actor_id: true }
    })
  ])

  const totalActors = Number((actorsQuery as any[])[0]?.count_distinct_actors || 0)
  const activeAssistants = new Set(assistantsRes.map((r) => r.actor_id)).size

  return {
    todayCount,
    totalActors,
    lastEventAt: lastEvent?.created_at?.toISOString() || null,
    activeAssistants,
  }
}

export async function getActorsList(): Promise<ActorOption[]> {
  if (!(await requireAdmin())) return []

  const data = await prisma.profiles.findMany({
    where: { role: { in: ['admin', 'assistant'] } },
    select: { id: true, full_name: true, role: true },
    orderBy: { full_name: 'asc' }
  })

  return data.map((p) => ({
    id: p.id,
    name: p.full_name ?? 'غير معروف',
    role: p.role as 'admin' | 'assistant',
  }))
}
