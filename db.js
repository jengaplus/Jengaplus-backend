const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const poolConfig = {
  connectionString: process.env.DATABASE_URL
};

if (process.env.PGSSLMODE && process.env.PGSSLMODE.toLowerCase() !== 'disable') {
  poolConfig.ssl = {
    rejectUnauthorized: process.env.PGSSLVERIFY ? process.env.PGSSLVERIFY.toLowerCase() !== 'false' : false
  };
} else if (process.env.DATABASE_URL && /(localhost|127\.0\.0\.1|::1)/.test(process.env.DATABASE_URL)) {
  poolConfig.ssl = false;
}

const pool = new Pool(poolConfig);

module.exports = pool;
