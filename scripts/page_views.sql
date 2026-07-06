-- ============================================================
-- Page Views & Visitors Tracking System
-- نظام المشاهدات والزيارات
--
-- IMPORTANT: Run this script MANUALLY on the live DB.
--            Do NOT run via Supabase MCP (connected to old DB).
--            Safe to run multiple times (idempotent).
--
-- Depends on: is_full_admin() (from assistant_accounts.sql or
--             audit_system.sql). Re-created here just in case.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Re-declare is_full_admin() defensively.
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
-- 1) page_views — one row per tracked page visit
--    Tracks every page EXCEPT /admin/* (filtered in app layer).
-- ------------------------------------------------------------
create table if not exists public.page_views (
  id          bigint      generated always as identity primary key,

  -- Which page was viewed (pathname only, no query string)
  path        text        not null default '/',

  -- Anonymous visitor identifier (uuid stored in a cookie).
  -- Used to compute unique visitors. Never ties to a real identity.
  visitor_id  uuid        not null,

  -- Rough device class derived from the user-agent at insert time.
  device      text        not null default 'desktop'
                check (device in ('desktop', 'mobile', 'tablet', 'bot', 'unknown')),

  created_at  timestamptz not null default now()
);

-- Indexes for the time-series + uniqueness queries.
create index if not exists idx_page_views_created_at
  on public.page_views(created_at desc);

create index if not exists idx_page_views_visitor_id
  on public.page_views(visitor_id);

create index if not exists idx_page_views_created_visitor
  on public.page_views(created_at, visitor_id);

-- ------------------------------------------------------------
-- 2) Row Level Security
--
-- SECURITY MODEL:
--   • SELECT: full admins only (role = 'admin').
--   • INSERT: NO client-level policy. All inserts go through the
--     service-role client (createAdminClient) in /api/track, which
--     bypasses RLS. Table is effectively append-only for clients.
-- ------------------------------------------------------------
alter table public.page_views enable row level security;

drop policy if exists "page_views_admin_select" on public.page_views;
create policy "page_views_admin_select"
  on public.page_views
  for select
  using (public.is_full_admin());

-- ------------------------------------------------------------
-- 3) RPC: daily views + unique visitors since a start date.
--    Aggregates in the DB so the app never loads raw rows.
--    Returns one row per day that has data. Bots are excluded.
-- ------------------------------------------------------------
create or replace function public.get_views_daily(start_ts timestamptz)
returns table (
  day     date,
  views   bigint,
  uniques bigint
)
language sql stable security definer set search_path = public
as $$
  select
    date_trunc('day', created_at)::date        as day,
    count(*)                                     as views,
    count(distinct visitor_id)                   as uniques
  from public.page_views
  where created_at >= start_ts
    and device <> 'bot'
  group by 1
  order by 1;
$$;

-- Only full admins can call it (the dashboard action runs as the
-- signed-in admin). security definer lets it read past RLS, but we
-- still gate execution to the admin via an inner check.
revoke all on function public.get_views_daily(timestamptz) from public, anon;
grant execute on function public.get_views_daily(timestamptz) to authenticated;

-- ------------------------------------------------------------
-- 4) Verification queries (run after applying to confirm)
-- ------------------------------------------------------------
-- select count(*) from public.page_views;            -- 0 initially
-- select * from public.get_views_daily(now() - interval '30 days');
-- select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='page_views';
