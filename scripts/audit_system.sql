-- ============================================================
-- Audit & Activity Monitoring System
-- نظام المراقبة والتدقيق
--
-- IMPORTANT: Run this script MANUALLY on the live DB.
--            Do NOT run via Supabase MCP (connected to old DB).
--            Safe to run multiple times (idempotent).
--
-- Depends on: scripts/assistant_accounts.sql must be run first
--             (provides is_full_admin() function).
--             If running standalone, is_full_admin() is re-created
--             here with CREATE OR REPLACE.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Re-declare is_full_admin() in case assistant_accounts.sql
--    hasn't been run yet on this DB.
-- ------------------------------------------------------------
create or replace function public.is_full_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- 1) activity_logs — records every write action by admin/assistant
-- ------------------------------------------------------------
create table if not exists public.activity_logs (
  id          uuid        primary key default gen_random_uuid(),

  -- Actor snapshot (set null on profile delete to preserve history)
  actor_id    uuid        references public.profiles(id) on delete set null,
  actor_name  text        not null default '',   -- snapshot at time of event
  actor_role  text        not null default ''    -- snapshot: 'admin' | 'assistant'
                check (actor_role in ('admin', 'assistant', '')),

  -- What happened
  action      text        not null
                check (action in ('create', 'update', 'delete', 'approve', 'reject')),

  -- What resource was touched (matches ResourceKey in lib/permissions.ts)
  resource    text        not null,

  -- What entity was affected
  target_id   text        null,   -- stringified id (flexible: uuid, int, slug…)
  target_label text       null,   -- human-readable Arabic description of the target

  -- Optional short sentence describing the action
  details     text        null,

  created_at  timestamptz not null default now()
);

-- Indexes for the most common query patterns
create index if not exists idx_activity_logs_created_at
  on public.activity_logs(created_at desc);

create index if not exists idx_activity_logs_actor_id
  on public.activity_logs(actor_id);

create index if not exists idx_activity_logs_resource
  on public.activity_logs(resource);

create index if not exists idx_activity_logs_target_id
  on public.activity_logs(target_id);

create index if not exists idx_activity_logs_action
  on public.activity_logs(action);

-- ------------------------------------------------------------
-- 2) auth_logs — records login/logout for admin/assistant only
-- ------------------------------------------------------------
create table if not exists public.auth_logs (
  id          uuid        primary key default gen_random_uuid(),

  -- Actor snapshot
  actor_id    uuid        references public.profiles(id) on delete set null,
  actor_name  text        not null default '',
  actor_role  text        not null default ''
                check (actor_role in ('admin', 'assistant', '')),

  -- Event type
  event       text        not null
                check (event in ('login', 'logout')),

  -- Connection metadata
  ip          text        null,
  user_agent  text        null,

  created_at  timestamptz not null default now()
);

create index if not exists idx_auth_logs_created_at
  on public.auth_logs(created_at desc);

create index if not exists idx_auth_logs_actor_id
  on public.auth_logs(actor_id);

-- ------------------------------------------------------------
-- 3) Row Level Security
--
-- SECURITY MODEL:
--   • SELECT: full admins only (role = 'admin').
--   • INSERT/UPDATE/DELETE: NO client-level policies.
--     All writes go through the service-role client in the
--     application layer (createAdminClient), which bypasses RLS.
--     This makes both tables effectively append-only from the
--     perspective of any authenticated user, including full admins.
-- ------------------------------------------------------------

alter table public.activity_logs enable row level security;
alter table public.auth_logs      enable row level security;

-- activity_logs: full admins can read, nobody can write via client
drop policy if exists "activity_logs_admin_select" on public.activity_logs;
create policy "activity_logs_admin_select"
  on public.activity_logs
  for select
  using (public.is_full_admin());

-- auth_logs: full admins can read, nobody can write via client
drop policy if exists "auth_logs_admin_select" on public.auth_logs;
create policy "auth_logs_admin_select"
  on public.auth_logs
  for select
  using (public.is_full_admin());

-- ------------------------------------------------------------
-- 4) Helper RPC: count distinct actors in activity_logs
--    Called by getActivityStats() to avoid loading all rows in JS.
-- ------------------------------------------------------------
create or replace function public.count_distinct_actors()
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(distinct actor_id) from public.activity_logs;
$$;

-- Grant execute to authenticated users (RLS on the table still applies for
-- direct queries; the function only returns the aggregate count).
grant execute on function public.count_distinct_actors() to authenticated;

-- ------------------------------------------------------------
-- 5) Verification queries (run after applying to confirm)
-- ------------------------------------------------------------
-- select count(*) from public.activity_logs;    -- should be 0 initially
-- select count(*) from public.auth_logs;        -- should be 0 initially
-- select policyname, cmd from pg_policies
--   where schemaname='public'
--   and tablename in ('activity_logs','auth_logs');
-- Expected: activity_logs_admin_select (SELECT), auth_logs_admin_select (SELECT)
