-- ============================================================================
-- تصنيفات (أقسام) داخل الكورس الشهري
-- ----------------------------------------------------------------------------
-- الهدف: تقسيم محاضرات الكورس الواحد لمجموعات مرتّبة (مثال: "المراجعة النهائية"،
-- "الفصل الأول"...). كل تصنيف بيتبع كورس شهري واحد، وكل محاضرة ممكن (اختياري)
-- تنتمي لتصنيف واحد داخل نفس الكورس.
--
-- شُغّل هذا الملف بالفعل على قاعدة البيانات الحيّة — تم إنشاء:
--   • جدول  : public.monthly_course_sections
--   • عمود  : public.lectures.monthly_course_section_id
-- ملحوظة: الملف ده للمرجعية فقط؛ التعديلات idempotent (آمنة التكرار).
-- ============================================================================

-- 1) جدول تصنيفات الكورسات الشهرية -----------------------------------------
create table if not exists public.monthly_course_sections (
  id                uuid primary key default gen_random_uuid(),
  monthly_course_id uuid not null references public.monthly_courses (id) on delete cascade,
  title             text not null,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists mcs_course_idx  on public.monthly_course_sections (monthly_course_id);
create index if not exists mcs_sort_idx    on public.monthly_course_sections (monthly_course_id, sort_order);

-- 2) ربط المحاضرة بتصنيف (اختياري) ------------------------------------------
alter table public.lectures
  add column if not exists monthly_course_section_id uuid
  references public.monthly_course_sections (id) on delete set null;

create index if not exists lectures_mcs_idx on public.lectures (monthly_course_section_id);

-- 3) RLS — قراءة عامة، كتابة عبر service role فقط ----------------------------
alter table public.monthly_course_sections enable row level security;

drop policy if exists "mcs_readable_by_everyone" on public.monthly_course_sections;
create policy "mcs_readable_by_everyone"
  on public.monthly_course_sections for select using (true);

drop policy if exists "mcs_admin_insert" on public.monthly_course_sections;
drop policy if exists "mcs_admin_update" on public.monthly_course_sections;
drop policy if exists "mcs_admin_delete" on public.monthly_course_sections;

create policy "mcs_admin_insert"
  on public.monthly_course_sections for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "mcs_admin_update"
  on public.monthly_course_sections for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "mcs_admin_delete"
  on public.monthly_course_sections for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
