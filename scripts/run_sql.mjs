import pkg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pkg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  try {
    const sql = fs.readFileSync(path.join(process.cwd(), 'scripts', 'add_what_you_learn.sql'), 'utf-8');
    await client.query(sql);
    console.log('SQL executed successfully!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}
run();
