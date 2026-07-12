-- Monthly courses: branch -> monthly course -> lectures.
-- Additive and idempotent; existing lectures remain uncategorized and continue to work.

create table if not exists public.monthly_courses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  image text,
  price numeric not null default 0 check (price >= 0),
  old_price numeric check (old_price is null or old_price >= price),
  badge text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, slug)
);

alter table public.lectures add column if not exists monthly_course_id uuid references public.monthly_courses(id) on delete set null;
alter table public.lectures add column if not exists course_sort_order integer not null default 0;

alter table public.cart_items add column if not exists monthly_course_id uuid references public.monthly_courses(id) on delete cascade;
alter table public.cart_items alter column lecture_id drop not null;
alter table public.order_items add column if not exists monthly_course_id uuid references public.monthly_courses(id) on delete set null;
alter table public.order_items add column if not exists item_type text not null default 'lecture';

alter table public.cart_items drop constraint if exists cart_items_one_product;
alter table public.cart_items add constraint cart_items_one_product check (num_nonnulls(lecture_id, monthly_course_id) = 1);
alter table public.order_items drop constraint if exists order_items_valid_type;
alter table public.order_items add constraint order_items_valid_type check (item_type in ('lecture', 'course_bundle'));

create unique index if not exists cart_items_student_lecture_unique on public.cart_items(student_id, lecture_id) where lecture_id is not null;
create unique index if not exists cart_items_student_monthly_course_unique on public.cart_items(student_id, monthly_course_id) where monthly_course_id is not null;
create index if not exists monthly_courses_branch_sort_idx on public.monthly_courses(branch_id, sort_order, created_at);
create index if not exists lectures_monthly_course_sort_idx on public.lectures(monthly_course_id, course_sort_order, sort_order);

alter table public.monthly_courses enable row level security;
drop policy if exists "monthly_courses_public_read" on public.monthly_courses;
create policy "monthly_courses_public_read" on public.monthly_courses for select using (is_published or public.is_admin());
drop policy if exists "monthly_courses_admin_all" on public.monthly_courses;
create policy "monthly_courses_admin_all" on public.monthly_courses for all using (public.is_admin()) with check (public.is_admin());

-- Prevent linking a lecture to a course in another branch.
create or replace function public.validate_lecture_monthly_course_branch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.monthly_course_id is not null and not exists (
    select 1 from public.monthly_courses mc
    where mc.id = new.monthly_course_id and mc.branch_id = new.branch_id
  ) then
    raise exception 'Lecture and monthly course must belong to the same branch';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_lecture_monthly_course_branch on public.lectures;
create trigger validate_lecture_monthly_course_branch
before insert or update of branch_id, monthly_course_id on public.lectures
for each row execute function public.validate_lecture_monthly_course_branch();
