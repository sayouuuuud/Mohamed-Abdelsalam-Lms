-- ============================================================================
-- تصنيفات (أقسام) داخل الكورس الشهري
-- ----------------------------------------------------------------------------
-- الهدف: تقسيم محاضرات الكورس الواحد لمجموعات مرتّبة (مثال: "المراجعة النهائية"،
-- "الفصل الأول"...). كل تصنيف بيتبع كورس شهري واحد، وكل محاضرة ممكن (اختياري)
-- تنتمي لتصنيف واحد داخل نفس الكورس.
--
-- شغّل الملف ده يدويًا على قاعدة البيانات الحيّة (idempotent — آمن التكرار).
-- ============================================================================

-- 1) جدول التصنيفات ---------------------------------------------------------
create table if not exists public.course_sections (
  id                uuid primary key default gen_random_uuid(),
  monthly_course_id uuid not null references public.monthly_courses (id) on delete cascade,
  title             text not null,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists course_sections_course_idx
  on public.course_sections (monthly_course_id);

create index if not exists course_sections_sort_idx
  on public.course_sections (monthly_course_id, sort_order);

-- 2) ربط المحاضرة بتصنيف (اختياري) ------------------------------------------
alter table public.lectures
  add column if not exists course_section_id uuid
  references public.course_sections (id) on delete set null;

create index if not exists lectures_course_section_idx
  on public.lectures (course_section_id);

-- 3) RLS ---------------------------------------------------------------------
-- التصنيفات بيانات منهج عامة للقراءة زي الكورسات؛ التعديل للأدمن فقط عبر
-- service role/السيرفر. لو RLS مفعّل على باقي الجداول، فعّله هنا بنفس السياسة.
alter table public.course_sections enable row level security;

drop policy if exists "course_sections readable by everyone" on public.course_sections;
create policy "course_sections readable by everyone"
  on public.course_sections
  for select
  using (true);
