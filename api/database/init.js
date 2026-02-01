const { exec } = require('../utils/db');

async function initializeDatabase() {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS gallery_photos (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      position BIGINT DEFAULT 0,
      alt TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Migration: add position column if it doesn't exist
  try {
    await exec(`ALTER TABLE gallery_photos ADD COLUMN position BIGINT DEFAULT 0`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: widen position column to BIGINT if it exists as INTEGER
  try {
    await exec(`ALTER TABLE gallery_photos ALTER COLUMN position TYPE BIGINT USING position::bigint`);
  } catch {
    // Column already BIGINT or table doesn't exist — ignore
  }

  // Backfill any null positions for older rows
  await exec(`UPDATE gallery_photos SET position = id WHERE position IS NULL`);

  // Migration: add role column if it doesn't exist (for existing databases)
  try {
    await exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'`);
  } catch {
    // Column already exists — ignore
  }

  // Ensure the first user (seeded admin) is a superadmin
  await exec(`UPDATE users SET role = 'superadmin' WHERE id = 1 AND role = 'admin'`);
}

module.exports = initializeDatabase;
