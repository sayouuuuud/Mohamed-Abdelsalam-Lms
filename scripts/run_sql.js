const { Client } = require('pg');
require('dotenv').config({path: '.env.local'});
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  const fs = require('fs');
  const sql = fs.readFileSync('scripts/add_enrollment_delete_policy.sql', 'utf8');
  return client.query(sql);
}).then(() => {
  console.log('Success');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
