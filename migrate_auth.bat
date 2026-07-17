@echo off
set SUPA=postgresql://postgres.ndfhplawpqsiktkwoyxd:Sayed8820066@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
set COOLIFY=postgresql://postgres:Mohamed2006abdeelsalam@169.58.19.247:5432/postgres

echo Dumping auth.users table from Supabase...
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" "%SUPA%" -t auth.users --no-owner --no-privileges -f auth_users.sql

echo Restoring auth.users to Coolify...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" "%COOLIFY%" -v ON_ERROR_STOP=0 -f auth_users.sql

echo Dumping auth.identities table from Supabase...
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" "%SUPA%" -t auth.identities --no-owner --no-privileges -f auth_identities.sql

echo Restoring auth.identities to Coolify...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" "%COOLIFY%" -v ON_ERROR_STOP=0 -f auth_identities.sql

echo Migration batch script completed.
