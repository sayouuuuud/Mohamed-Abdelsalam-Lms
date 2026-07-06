-- ============================================================
-- Assistant Accounts: table + helper functions + RLS policies
-- Safe to run multiple times (idempotent).
-- Admins keep full access via existing is_admin() policies.
-- Assistants get additive policies driven by assistant_permissions.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Permissions table
-- ------------------------------------------------------------
create table if not exists public.assistant_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  resource text not null,
  access_level text not null default 'none'
    check (access_level in ('none', 'view', 'manage')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (profile_id, resource)
);

create index if not exists idx_assistant_permissions_profile
  on public.assistant_permissions(profile_id);

-- ------------------------------------------------------------
-- 2) Helper functions
-- ------------------------------------------------------------

-- Is the current user a full admin (role = 'admin')?
create or replace function public.is_full_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Does the current user have permission on a resource at a given level?
-- Full admins always pass. Assistants pass based on assistant_permissions.
-- level 'view'   => access_level in ('view','manage')
-- level 'manage' => access_level = 'manage'
create or replace function public.has_permission(p_resource text, p_level text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    public.is_full_admin()
    or exists (
      select 1
      from public.assistant_permissions ap
      join public.profiles pr on pr.id = ap.profile_id
      where ap.profile_id = auth.uid()
        and pr.role = 'assistant'
        and ap.resource = p_resource
        and (
          ap.access_level = 'manage'
          or (p_level = 'view' and ap.access_level in ('view', 'manage'))
        )
    );
$$;

-- ------------------------------------------------------------
-- 3) RLS on assistant_permissions itself
--    Full admins: full access. Assistants: read own rows only.
-- ------------------------------------------------------------
alter table public.assistant_permissions enable row level security;

drop policy if exists "ap_admin_all" on public.assistant_permissions;
create policy "ap_admin_all" on public.assistant_permissions
  for all using (public.is_full_admin()) with check (public.is_full_admin());

drop policy if exists "ap_read_own" on public.assistant_permissions;
create policy "ap_read_own" on public.assistant_permissions
  for select using (profile_id = auth.uid());

-- ------------------------------------------------------------
-- 4) Additive assistant policies for every resource-backed table
--    (admin policies remain untouched; these are OR'd in)
--
-- IMPORTANT SECURITY NOTE:
--   Postgres IGNORES policies on any table where RLS is NOT enabled.
--   Several core tables (students, courses, lectures, orders, branches,
--   stages, site_content, site_theme, ...) currently do NOT have RLS
--   enabled in this project. On those tables the policies below are
--   inert, so the REAL enforcement for assistants is the application
--   layer: every write path goes through a server action guarded by
--   hasResourceAccess(..., 'manage'), and reads through 'view'.
--   Do NOT blindly `enable row level security` on those tables here —
--   doing so without first porting the existing admin/student access
--   rules would lock out admins and students. Enable RLS per-table only
--   after auditing that table's full policy set.
-- ------------------------------------------------------------
do $$
declare
  rec record;
  -- (table_name, resource_key)
  pairs text[][] := array[
    -- students
    ['students','students'], ['enrollments','students'],
    ['student_devices','students'], ['certificates','students'],
    -- categories / taxonomy
    ['categories','categories'], ['branches','categories'], ['stages','categories'],
    -- courses / content
    ['courses','courses'], ['course_lessons','courses'], ['course_sections','courses'],
    ['lectures','courses'], ['lessons','courses'],
    ['assignments','courses'], ['assignment_questions','courses'],
    ['assignment_submissions','courses'], ['lesson_progress','courses'],
    -- exams
    ['exams','exams'], ['exam_questions','exams'],
    ['exam_answers','exams'], ['exam_submissions','exams'],
    -- calendar
    ['calendar_events','calendar'],
    -- payments / orders
    ['orders','payments'], ['order_items','payments'],
    ['payments','payments'], ['cart_items','payments'],
    -- messages
    ['messages','messages'],
    -- notifications
    ['notifications','notifications'], ['notification_reads','notifications'],
    -- coupons
    ['coupons','coupons'], ['coupon_lectures','coupons'],
    -- reports
    ['reports','reports'],
    -- settings
    ['settings','settings'], ['site_content','settings'], ['site_theme','settings']
  ];
  i int;
  tbl text;
  res text;
begin
  for i in 1 .. array_length(pairs, 1) loop
    tbl := pairs[i][1];
    res := pairs[i][2];

    -- skip tables that don't exist (defensive)
    if not exists (
      select 1 from pg_tables where schemaname='public' and tablename=tbl
    ) then
      continue;
    end if;

    -- view policy (SELECT)
    execute format('drop policy if exists %I on public.%I', tbl || '_assistant_view', tbl);
    execute format(
      'create policy %I on public.%I for select using (public.has_permission(%L, %L))',
      tbl || '_assistant_view', tbl, res, 'view'
    );

    -- manage policy (ALL: insert/update/delete + select when manage)
    execute format('drop policy if exists %I on public.%I', tbl || '_assistant_manage', tbl);
    execute format(
      'create policy %I on public.%I for all using (public.has_permission(%L, %L)) with check (public.has_permission(%L, %L))',
      tbl || '_assistant_manage', tbl, res, 'manage', res, 'manage'
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5) Profiles: allow assistants to read student/assistant profiles
--    when they have the 'students' resource (needed by admin UI lists).
--    Full admins already covered by existing policy.
-- ------------------------------------------------------------
drop policy if exists "profiles_assistant_read" on public.profiles;
create policy "profiles_assistant_read" on public.profiles
  for select using (
    auth.uid() = id
    or public.has_permission('students', 'view')
  );
