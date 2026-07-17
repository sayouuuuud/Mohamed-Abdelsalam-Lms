const { Client } = require('pg');

async function testConnection(host, password) {
  const client = new Client({
    user: 'postgres',
    host: host,
    database: 'postgres',
    password: password,
    port: 5432,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    const res = await client.query('SELECT current_database();');
    console.log(`Successfully connected to ${host}! DB:`, res.rows[0].current_database);
    
    // Test if 'users' table exists
    try {
      const usersRes = await client.query("SELECT count(*) FROM users");
      console.log(`Users count on ${host}:`, usersRes.rows[0].count);
    } catch (e) {
      console.log(`Users table not found on ${host}:`, e.message);
    }

    await client.end();
  } catch (err) {
    console.error(`Connection failed to ${host}:`, err.message);
  }
}

async function main() {
  await testConnection('localhost', 'Mohamed2006abdeelsalam');
  await testConnection('169.58.19.247', 'Mohamed2006abdeelsalam');
}

main();
