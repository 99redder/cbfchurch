const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || '';
const needsSsl = process.env.NODE_ENV === 'production' || dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : false
});

// Neon suspends idle computes and drops their connections. Without a listener,
// an error on an idle pooled client is an uncaught exception that crashes the
// server; the pool already discards the dead client, so just log it.
pool.on('error', (err) => {
  console.error('Idle database client error:', err.message);
});

const CONNECTION_ERROR_CODES = ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', '57P01', '57P02', '57P03', '08006', '08003', '08001'];

function isConnectionError(err) {
  return CONNECTION_ERROR_CODES.includes(err.code) ||
    /Connection terminated|connection timeout|terminating connection/i.test(err.message || '');
}

// Run a query, retrying once on a fresh connection if the pooled one had
// been dropped (e.g. Neon waking from suspend).
async function query(sql, params) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    console.error('Database connection error, retrying:', err.message);
    return pool.query(sql, params);
  }
}

// Helper: run a statement that modifies data (INSERT, UPDATE, DELETE)
// If the query has RETURNING, returns the first row
async function run(sql, params = []) {
  const result = await query(sql, params);
  return {
    rowCount: result.rowCount,
    rows: result.rows,
    lastInsertId: result.rows.length > 0 ? result.rows[0].id : null
  };
}

// Helper: get one row
async function get(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

// Helper: get all rows
async function all(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

// Helper: execute raw SQL (for CREATE TABLE, etc.)
async function exec(sql) {
  await query(sql);
}

module.exports = { pool, run, get, all, exec };
