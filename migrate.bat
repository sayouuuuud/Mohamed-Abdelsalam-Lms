@echo off
set SUPA=postgresql://postgres.ndfhplawpqsiktkwoyxd:Sayed8820066@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
set COOLIFY=postgresql://postgres:Mohamed2006abdeelsalam@169.58.19.247:5432/postgres

echo Running shim.sql on Coolify...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" "%COOLIFY%" -f shim.sql

echo Dumping public schema from Supabase...
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" "%SUPA%" --schema=public --no-owner --no-privileges --no-publications --no-subscriptions --quote-all-identifiers -f supabase_public.sql

echo Restoring to Coolify...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" "%COOLIFY%" -v ON_ERROR_STOP=0 -f supabase_public.sql > restore_warnings.log 2>&1

echo Dumping auth users from Supabase...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" "%SUPA%" -c "\copy (SELECT id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at FROM auth.users ORDER BY created_at) TO 'auth_users.csv' WITH CSV HEADER"

echo Migration batch script completed.
