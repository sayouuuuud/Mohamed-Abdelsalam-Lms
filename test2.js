const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: 'd:/LMS/.env.local' });
const client = new Client(process.env.DATABASE_URL);
(async () => {
  await client.connect();
  const res = await client.query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE conname LIKE '%students%'");
  console.log(res.rows);
  await client.end();
})();
