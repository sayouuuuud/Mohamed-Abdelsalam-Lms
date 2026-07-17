-- Apply this migration to the PostgreSQL database before redeploying the transcoder.
-- It replaces drifted claim functions with one worker-aware, lease-based contract.

begin;

drop function if exists public.claim_next_video_job();
drop function if exists public.claim_next_video_job(text);

create function public.claim_next_video_job(p_worker_id text)
returns table (
  job_id uuid,
  video_id uuid,
  r2_raw_key text,
  threads_override integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_video_id uuid;
  v_r2_raw_key text;
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'worker id is required';
  end if;

  select vj.id, vj.video_id, v.r2_raw_key
    into v_job_id, v_video_id, v_r2_raw_key
    from public.video_jobs as vj
    join public.videos as v on v.id = vj.video_id
   where vj.attempts < 3
     and v.r2_raw_key is not null
     and (
       vj.status in ('queued', 'failed')
       or (
         vj.status = 'claimed'
         and vj.claimed_at < now() - interval '30 minutes'
       )
     )
   order by
     case when vj.status = 'claimed' then 0 else 1 end,
     vj.created_at asc
   limit 1
   for update of vj skip locked;

  if v_job_id is null then
    return;
  end if;

  update public.video_jobs
     set status = 'claimed',
         attempts = attempts + 1,
         last_error = null,
         claimed_by = p_worker_id,
         claimed_at = now(),
         completed_at = null,
         updated_at = now()
   where id = v_job_id;

  return query
  select v_job_id, v_video_id, v_r2_raw_key, null::integer;
end;
$$;

revoke all on function public.claim_next_video_job(text) from public;

commit;
