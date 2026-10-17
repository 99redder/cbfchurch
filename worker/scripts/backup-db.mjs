// Dump every app table from Neon to a timestamped JSON file (run locally).
// Usage: node scripts/backup-db.mjs   (reads DATABASE_URL from ../api/.env)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const envText = readFileSync(new URL('../../api/.env', import.meta.url), 'utf8');
const url = process.env.DATABASE_URL || envText.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
const sql = neon(url);

const out = {};
for (const table of ['posts', 'users', 'gallery_photos', 'site_content']) {
  out[table] = await sql.query(`SELECT * FROM ${table} ORDER BY 1`);
  console.log(`${table}: ${out[table].length} rows`);
}
mkdirSync(new URL('../backups/', import.meta.url), { recursive: true });
const file = new URL(`../backups/db-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(out, null, 2));
console.log('Saved', file.pathname);
