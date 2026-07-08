const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: 'd:/LMS/.env.local' });
const client = new Client(process.env.DATABASE_URL);
(async () => {
  await client.connect();
  const res = await client.query('SELECT user_id FROM students WHERE user_id IS NOT NULL LIMIT 1');
  const userId = res.rows[0].user_id;
  try {
    const q = 'INSERT INTO messages (code, sender_name, subject, content, time_label, student_id) VALUES ($1, $2, $3, $4, $5, $6)';
    await client.query(q, ['TEST-123', 'test', 'test', 'test', 'now', userId]);
    console.log('Insert success');
    await client.query('DELETE FROM messages WHERE code = $1', ['TEST-123']);
  } catch(e) {
    console.log('Insert error:', e.message);
  }
  await client.end();
})();
