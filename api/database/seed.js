// Run with: node database/seed.js <username> <password>
// Creates the first admin account

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { get, run } = require('../utils/db');
const { hashPassword } = require('../utils/auth');
const initializeDatabase = require('./init');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node database/seed.js <username> <password>');
  process.exit(1);
}

if (password.length < 6) {
  console.error('Password must be at least 6 characters');
  process.exit(1);
}

async function seed() {
  await initializeDatabase();

  const existing = await get('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) {
    console.error(`User "${username}" already exists`);
    process.exit(1);
  }

  const hash = hashPassword(password);
  await run('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hash]);
  console.log(`Admin account "${username}" created successfully`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
