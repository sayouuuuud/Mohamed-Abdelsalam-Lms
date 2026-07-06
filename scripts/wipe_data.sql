-- ============================================================================
-- Danger Zone: wipe ALL site data except public-page content + settings.
--
-- Creates a SECURITY DEFINER function that:
--   1. Truncates every base table in the `public` schema EXCEPT the preserved
--      config tables (site_content, site_theme, settings) and `profiles`.
--      Using a single TRUNCATE ... CASCADE resolves any inter-table foreign
--      keys automatically, so this stays correct even for tables that only
--      exist on the live DB (lectures, orders, stages, branches, cart_items…).
--   2. Deletes every profile + auth account EXCEPT the acting admin, so only
--      the admin who triggered the wipe can still sign in.
--
-- The function is dynamic: it discovers tables at run time, so it does not
-- need to be updated when new tables are added.
--
-- Run this ONCE on the live DB. The admin-panel button then calls it via RPC.
-- ============================================================================

create or replace function public.admin_wipe_all_data(keep_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Tables that must survive the wipe (public pages + configuration).
  keep_tables text[] := array['site_content', 'site_theme', 'settings', 'profiles'];
  table_list  text;
begin
  -- Build a comma-separated, schema-qualified list of every table to wipe.
  select string_agg(format('%I.%I', schemaname, tablename), ', ')
    into table_list
  from pg_tables
  where schemaname = 'public'
    and tablename <> all(keep_tables);

  -- Truncate them all in one shot; CASCADE clears dependent rows safely.
  if table_list is not null then
    execute 'truncate table ' || table_list || ' restart identity cascade';
  end if;

  -- Remove all accounts except the acting admin.
  delete from public.profiles where id <> keep_admin_id;
  delete from auth.users where id <> keep_admin_id;
end;
$$;

-- Lock the function down: only the service role may execute it.
revoke all on function public.admin_wipe_all_data(uuid) from public;
revoke all on function public.admin_wipe_all_data(uuid) from anon, authenticated;
grant execute on function public.admin_wipe_all_data(uuid) to service_role;
