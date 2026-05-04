const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { get, run } = require('../utils/db');
const { hashPassword, verifyPassword, createToken, requireAuth, requireSuperAdmin } = require('../utils/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!normalizedUsername || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await get('SELECT * FROM users WHERE username = $1', [normalizedUsername]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = createToken(user.id, user.username, user.role);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ message: 'Login successful', username: user.username, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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

// POST /api/auth/register (protected - requires superadmin)
router.post('/register', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!normalizedUsername || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' });
    }
    if (!/^[a-z0-9._-]{3,64}$/.test(normalizedUsername)) {
      return res.status(400).json({ error: 'Username must be 3-64 characters and use letters, numbers, dots, underscores, or hyphens.' });
    }

    const validRoles = ['admin', 'superadmin'];
    const userRole = validRoles.includes(role) ? role : 'admin';

    const existing = await get('SELECT id FROM users WHERE username = $1', [normalizedUsername]);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hash = hashPassword(password);
    const result = await run(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
      [normalizedUsername, hash, userRole]
    );

    res.status(201).json({ message: 'Admin account created', id: result.lastInsertId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me (check if logged in)
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, userId: req.user.userId, role: req.user.role });
});

module.exports = router;
