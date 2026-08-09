const { Pool } = require('pg');
require('dotenv').config();

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const r = await pool.query('SELECT NOW()');
    console.log('Connected — server time:', r.rows[0].now);
    process.exit(0);
  } catch (e) {
    console.error('DB test error:', e.message || e);
    process.exit(1);
  } finally {
    await pool.end().catch(()=>{});
  }
})();
