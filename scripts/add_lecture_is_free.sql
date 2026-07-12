-- ============================================================================
-- خيار "محاضرة مجانية" داخل الكورس
-- المحاضرة تفضل تابعة للكورس، لكن لو is_free = true يبقى أي زائر (حتى بدون
-- تسجيل) يقدر يتفرج عليها ودروسها.
-- ============================================================================

alter table public.lectures
  add column if not exists is_free boolean not null default false;

-- فهرس بسيط للاستعلام عن المحاضرات المجانية
create index if not exists lectures_is_free_idx
  on public.lectures (is_free)
  where is_free = true;
