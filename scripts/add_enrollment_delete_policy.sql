-- Allow students to delete their own enrollments
drop policy if exists "enroll_delete_own" on public.enrollments;
create policy "enroll_delete_own" on public.enrollments for delete using (
  student_id in (select id from public.students where user_id = auth.uid())
);
