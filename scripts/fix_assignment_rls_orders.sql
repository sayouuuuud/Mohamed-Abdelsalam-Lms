-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: students can't see lecture assignments they purchased.
--
-- Root cause: the live `assignments` SELECT policy (asg_student_select) gates
-- visibility on the `enrollments` table:
--
--   lecture_id IN (
--     SELECT en.course_id FROM enrollments en
--     JOIN students st ON st.id = en.student_id
--     WHERE st.user_id = auth.uid()
--   )
--
-- But the student portal grants lecture ownership through APPROVED ORDERS
-- (orders + order_items.lecture_id), NOT through `enrollments`. Also
-- `enrollments.course_id` points at the legacy `courses` table, whose ids do
-- not match `lectures.id`. As a result, a student who bought a lecture has no
-- matching enrollment row, so the RLS check fails and the assignment is hidden
-- — while lessons (public read) still show. That's the reported symptom:
-- the lesson appears but its assignment does not.
--
-- Fix: allow a student to read an assignment when they own its parent lecture
-- via an approved order. Keep enrollment-based access as an OR fallback so no
-- existing access is removed, and keep full admin access.
--
-- Run this on the LIVE database.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: does the current user own this lecture through an approved order?
create or replace function public.owns_lecture_via_order(p_lecture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.status = 'approved'
      and o.student_id = auth.uid()
      and oi.lecture_id = p_lecture_id
  );
$$;

-- ── assignments: replace the enrollment-only student policy ──────────────────
drop policy if exists "asg_student_select" on public.assignments;
drop policy if exists "asg_select_auth" on public.assignments;

create policy "asg_student_select" on public.assignments
  for select using (
    public.is_admin()
    or public.owns_lecture_via_order(lecture_id)
    or lecture_id in (
      select en.course_id
      from public.enrollments en
      join public.students st on st.id = en.student_id
      where st.user_id = auth.uid()
    )
  );

-- ── assignment_questions: mirror the parent assignment's visibility ──────────
-- The current live policy (asgq_select_auth) lets any authenticated user read
-- every question. Tighten it so questions follow the parent assignment's
-- ownership rules instead of leaking across lectures.
drop policy if exists "asgq_select_auth" on public.assignment_questions;
drop policy if exists "asgq_student_select" on public.assignment_questions;

create policy "asgq_student_select" on public.assignment_questions
  for select using (
    public.is_admin()
    or exists (
      select 1
      from public.assignments a
      where a.id = assignment_questions.assignment_id
        and (
          public.owns_lecture_via_order(a.lecture_id)
          or a.lecture_id in (
            select en.course_id
            from public.enrollments en
            join public.students st on st.id = en.student_id
            where st.user_id = auth.uid()
          )
        )
    )
  );
