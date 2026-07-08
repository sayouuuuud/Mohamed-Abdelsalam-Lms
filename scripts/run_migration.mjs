import fs from 'fs';
import pg from 'pg';

const client = new pg.Client('postgresql://postgres.ndfhplawpqsiktkwoyxd:Sayed8820066@aws-1-us-east-1.pooler.supabase.com:6543/postgres');
await client.connect();
const sql = fs.readFileSync('scripts/allow_assistant_role.sql', 'utf8');
await client.query(sql);
console.log('Migration successful');
await client.end();
