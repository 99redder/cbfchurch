const express = require('express');
const router = express.Router();
const { get, run } = require('../utils/db');
const { hashPassword, verifyPassword, createToken, requireAuth } = require('../utils/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = createToken(user.id, user.username);
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({ message: 'Login successful', username: user.username });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ message: 'Logged out' });
});

// POST /api/auth/register (protected - requires existing admin)
router.post('/register', requireAuth, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const hash = hashPassword(password);
  const result = run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);

  res.status(201).json({ message: 'Admin account created', id: result.lastInsertRowid });
});

// GET /api/auth/me (check if logged in)
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, userId: req.user.userId });
});

module.exports = router;
