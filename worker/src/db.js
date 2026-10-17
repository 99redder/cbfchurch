// Neon's serverless driver sends each query over HTTPS, so there is no
// connection pool to keep alive between Worker requests.
import { neon } from '@neondatabase/serverless';

export function createDb(databaseUrl) {
  const sql = neon(databaseUrl, { fullResults: true });

  async function query(text, params = []) {
    try {
      return await sql.query(text, params);
    } catch (err) {
      // Retry once on a network-level failure (e.g. Neon waking from suspend).
      // Postgres errors carry a SQLSTATE code and are not retried.
      if (err.code) throw err;
      console.error('Database request failed, retrying:', err.message);
      return sql.query(text, params);
    }
  }

  return {
    // Statement that modifies data; with RETURNING id, lastInsertId is set
    async run(text, params) {
      const result = await query(text, params);
      return {
        rowCount: result.rowCount,
        rows: result.rows,
        lastInsertId: result.rows.length > 0 ? result.rows[0].id : null
      };
    },
    async get(text, params) {
      const result = await query(text, params);
      return result.rows[0] || null;
    },
    async all(text, params) {
      const result = await query(text, params);
      return result.rows;
    }
  };
}
