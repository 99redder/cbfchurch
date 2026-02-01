const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || '';
const needsSsl = process.env.NODE_ENV === 'production' || dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : false
});

// Helper: run a statement that modifies data (INSERT, UPDATE, DELETE)
// If the query has RETURNING, returns the first row
async function run(sql, params = []) {
  const result = await pool.query(sql, params);
  return {
    rowCount: result.rowCount,
    rows: result.rows,
    lastInsertId: result.rows.length > 0 ? result.rows[0].id : null
  };
}

// Helper: get one row
async function get(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

// Helper: get all rows
async function all(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// Helper: execute raw SQL (for CREATE TABLE, etc.)
async function exec(sql) {
  await pool.query(sql);
}

module.exports = { pool, run, get, all, exec };
