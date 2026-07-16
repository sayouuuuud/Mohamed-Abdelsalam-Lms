# Milestone 0 — Database Export & Import (run these on YOUR machine)

v0 cannot reach your Supabase or Coolify Postgres, so **you** run every command
below. Work top to bottom. At the end you compare row counts and report back.

You need `psql` and `pg_dump` installed locally. **Important:** your local
`pg_dump` major version must be **>= your Supabase Postgres major version**.
Check with `pg_dump --version`. If it's older, install a matching client
(e.g. `brew install postgresql@17` or the PostgreSQL apt repo).

---

## 0. Connection strings you'll need

From **Supabase Dashboard → Project Settings → Database → Connection string → URI**.
Use the **Session pooler** or **Direct connection** (NOT the transaction pooler on
6543 — `pg_dump` needs a session connection on port 5432).

```bash
# Supabase source (fill in your password + region/ref)
export SUPA="postgresql://postgres.ndfhplawpqsiktkwoyxd:[YOUR-DB-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require"

# Coolify target = your DIRECT_URL (externally reachable host:port that Coolify exposes)
export COOLIFY="postgresql://[USER]:[PASSWORD]@[COOLIFY-HOST]:[PORT]/[DB]?sslmode=disable"
```

> `DATABASE_URL` (internal Docker network host) is for the running app later.
> For M0 import you use the **direct/external** URL (`$COOLIFY` above), which
> becomes your `DIRECT_URL` in M2.

---

## 1. Pre-restore shim on Coolify (roles + auth stubs)

The Supabase dump contains RLS policies (`TO authenticated`, `TO anon`) and
functions that call `auth.uid()`. Vanilla Postgres doesn't have those roles or
the `auth` schema, so create harmless stubs **before** restoring. Prisma
connects as the DB superuser and bypasses RLS anyway — these just let the dump
restore cleanly and keep the policies as a readable spec for M5.

Save as `shim.sql` and run: `psql "$COOLIFY" -f shim.sql`

```sql
-- Supabase-compatible roles (no login; policies reference them)
DO $$ BEGIN CREATE ROLE anon NOLOGIN;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Minimal auth schema + stubs so policy/function bodies resolve
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()  RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',  true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role', true), '') $$;
CREATE OR REPLACE FUNCTION auth.jwt()  RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
```

---

## 2. Export the `public` schema (structure + data + functions + triggers)

```bash
pg_dump "$SUPA" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-publications \
  --no-subscriptions \
  --quote-all-identifiers \
  -f supabase_public.sql
```

This single file contains: all 50 tables, their data, the 13 functions, the 4
triggers, and the RLS policies (kept as spec).

---

## 3. Export auth users separately (for password preservation in M4)

We don't restore Supabase's whole `auth` schema — we only need the login data.
Export it to CSV:

```bash
psql "$SUPA" -c "\copy (SELECT id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at FROM auth.users ORDER BY created_at) TO 'auth_users.csv' WITH CSV HEADER"
```

Keep `auth_users.csv` safe (it contains bcrypt hashes — not plaintext, but still
sensitive). M4 imports it into the new `users` table.

---

## 4. Restore into Coolify Postgres

```bash
# shim first (step 1), then the data
psql "$COOLIFY" -f shim.sql
psql "$COOLIFY" -v ON_ERROR_STOP=0 -f supabase_public.sql 2> restore_warnings.log
```

`ON_ERROR_STOP=0` lets it push through any residual Supabase-specific noise
(e.g. `GRANT`s to roles you didn't create). Review `restore_warnings.log`
afterward — real table/data errors matter; grant/ownership warnings do not.

---

## 5. Verify row counts (run on BOTH databases, compare)

First generate the count query (run once on either DB — schema is identical):

```bash
psql "$SUPA" -t -A -c "SELECT string_agg(format('SELECT %L AS tbl, count(*) AS n FROM public.%I', tablename, tablename), E'\nUNION ALL\n' ORDER BY tablename) FROM pg_tables WHERE schemaname='public';" > count_query.sql
```

Then run it on each and diff:

```bash
psql "$SUPA"    -f count_query.sql -t -A -F',' | sort > counts_supabase.csv
psql "$COOLIFY" -f count_query.sql -t -A -F',' | sort > counts_coolify.csv
diff counts_supabase.csv counts_coolify.csv && echo "✅ ROW COUNTS MATCH" || echo "❌ MISMATCH — see diff above"
```

**Milestone 0 gate:** `diff` reports no differences (or only expected ones you
understand). Reply here with the result (and `auth.users` count — should be 23).

---

## Notes / expectations
- `handle_new_user`, `is_admin`, `is_full_admin`, `has_permission`,
  `owns_lecture_via_order` restore but become inert (they supported RLS/auth).
  They stay as the authorization spec for **M5**; the app won't call them.
- The 6 RPCs the app actually uses are kept live: `count_distinct_actors`,
  `get_views_daily`, `get_advanced_analytics`, `admin_wipe_all_data`,
  `increment_coupon_used`, `claim_video_job`.
- Do **not** delete the Supabase project yet — it's our rollback until M7.
