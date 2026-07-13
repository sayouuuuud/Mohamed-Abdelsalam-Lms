-- =============================================================
-- نظام Streaming الفيديو — M1: مخطط قاعدة البيانات
-- شغّل هذا الملف يدوياً على الـ live DB
-- =============================================================

-- ---------------------------------------------------------------
-- 1. جدول videos — يخزن metadata لكل فيديو
-- ---------------------------------------------------------------
create table if not exists public.videos (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid not null references public.lessons(id) on delete cascade,
  r2_raw_key      text,           -- مسار الملف الخام على R2 بعد الرفع المباشر
  r2_hls_prefix   text,           -- prefix لملفات HLS على R2  e.g. "hls/uuid/"
  status          text not null default 'pending'
                  check (status in ('pending','processing','ready','error')),
  duration_sec    integer,        -- مدة الفيديو بالثواني (يملأها الوركر)
  error_message   text,           -- آخر رسالة خطأ لو status='error'
  renditions      jsonb,          -- [{quality:'1080p',bandwidth:4000000}, ...]
  file_size_bytes bigint,         -- حجم الملف الخام
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists videos_lesson_id_idx on public.videos (lesson_id);
create index if not exists videos_status_idx    on public.videos (status);

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- 2. جدول video_jobs — طابور مهام الوركر
-- ---------------------------------------------------------------
create table if not exists public.video_jobs (
  id              uuid primary key default gen_random_uuid(),
  video_id        uuid not null references public.videos(id) on delete cascade,
  status          text not null default 'queued'
                  check (status in ('queued','claimed','done','failed')),
  attempts        integer not null default 0,
  last_error      text,
  claimed_by      text,           -- worker instance ID
  claimed_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists video_jobs_status_idx    on public.video_jobs (status);
create index if not exists video_jobs_video_id_idx  on public.video_jobs (video_id);

drop trigger if exists video_jobs_set_updated_at on public.video_jobs;
create trigger video_jobs_set_updated_at
  before update on public.video_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- 3. دالة claim_video_job — atomic claim لتجنّب race conditions
--    الوركر بيستدعيها عوض UPDATE مباشرة
-- ---------------------------------------------------------------
create or replace function public.claim_video_job(p_worker_id text)
returns table(
  job_id    uuid,
  video_id  uuid,
  r2_raw_key text
)
language plpgsql security definer as $$
declare
  v_job_id   uuid;
  v_video_id uuid;
  v_raw_key  text;
begin
  -- اختار أقدم job في حالة queued أو failed وعدد المحاولات < 3
  select vj.id, vj.video_id, v.r2_raw_key
    into v_job_id, v_video_id, v_raw_key
    from public.video_jobs vj
    join public.videos v on v.id = vj.video_id
   where vj.status in ('queued', 'failed')
     and vj.attempts < 3
   order by vj.created_at asc
   limit 1
   for update skip locked;

  if v_job_id is null then
    return;  -- مفيش شغل
  end if;

  update public.video_jobs
     set status     = 'claimed',
         claimed_by = p_worker_id,
         claimed_at = now(),
         attempts   = attempts + 1
   where id = v_job_id;

  return query select v_job_id, v_video_id, v_raw_key;
end;
$$;

-- ---------------------------------------------------------------
-- 4. جدول streaming_settings — singleton للإعدادات
-- ---------------------------------------------------------------
create table if not exists public.streaming_settings (
  id                   integer primary key default 1
                       check (id = 1),   -- singleton: صف واحد بس
  enabled              boolean not null default true,
  worker_cpu_threads   integer not null default 2
                       check (worker_cpu_threads between 1 and 32),
  worker_ram_mb        integer not null default 2048
                       check (worker_ram_mb between 512 and 65536),
  worker_concurrency   integer not null default 1
                       check (worker_concurrency between 1 and 8),
  renditions           jsonb   not null default '[
    {"name":"360p",  "width":640,  "height":360,  "vbitrate":"600k",  "abitrate":"64k"},
    {"name":"480p",  "width":854,  "height":480,  "vbitrate":"1200k", "abitrate":"96k"},
    {"name":"720p",  "width":1280, "height":720,  "vbitrate":"2500k", "abitrate":"128k"},
    {"name":"1080p", "width":1920, "height":1080, "vbitrate":"5000k", "abitrate":"192k"}
  ]'::jsonb,
  segment_duration_sec integer not null default 4
                       check (segment_duration_sec between 2 and 10),
  updated_at           timestamptz not null default now()
);

drop trigger if exists streaming_settings_updated_at on public.streaming_settings;
create trigger streaming_settings_updated_at
  before update on public.streaming_settings
  for each row execute function public.set_updated_at();

-- أدخل الصف الافتراضي لو مش موجود
insert into public.streaming_settings (id) values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- 5. تعديل جدول lessons — إضافة video_id
--    (video_url ييجي يفضل كـ fallback للفيديوهات القديمة)
-- ---------------------------------------------------------------
alter table public.lessons
  add column if not exists video_id uuid references public.videos(id) on delete set null;

create index if not exists lessons_video_id_idx on public.lessons (video_id);

-- ---------------------------------------------------------------
-- 6. RLS — streaming_settings و videos مرئيان للأدمن فقط
-- ---------------------------------------------------------------
alter table public.streaming_settings enable row level security;
alter table public.videos             enable row level security;
alter table public.video_jobs         enable row level security;

-- مسح السياسات القديمة لو موجودة قبل إعادة الإنشاء
drop policy if exists "admin_all_streaming_settings" on public.streaming_settings;
drop policy if exists "admin_all_videos"             on public.videos;
drop policy if exists "admin_all_video_jobs"         on public.video_jobs;
drop policy if exists "service_role_all_videos"      on public.videos;
drop policy if exists "service_role_all_video_jobs"  on public.video_jobs;

-- الأدمن (service_role يتجاوز RLS تلقائياً)
-- سياسة authenticated للأدمن فقط (يعتمد على دالة is_admin الموجودة)
-- ملاحظة: دالة is_admin() في هذه القاعدة بدون arguments (تقرأ auth.uid() داخلياً)
create policy "admin_all_streaming_settings"
  on public.streaming_settings for all
  to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

create policy "admin_all_videos"
  on public.videos for all
  to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

create policy "admin_all_video_jobs"
  on public.video_jobs for all
  to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------
-- 7. منح الصلاحيات لـ service_role (للوركر)
-- ---------------------------------------------------------------
grant select, insert, update on public.videos         to service_role;
grant select, insert, update on public.video_jobs     to service_role;
grant select                 on public.streaming_settings to service_role;
grant execute                on function public.claim_video_job(text) to service_role;

-- ---------------------------------------------------------------
-- ملاحظة: شغّل هذا الملف على الـ live DB يدوياً
-- لا تستخدم Supabase MCP لأنه متصل بداتابيز قديمة
-- =============================================================
