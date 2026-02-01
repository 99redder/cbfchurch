const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.SESSION_SECRET || 'default-dev-secret';
const TOKEN_EXPIRY = '24h';

function hashPassword(plaintext) {
  return bcrypt.hashSync(plaintext, 10);
}

function verifyPassword(plaintext, hash) {
  return bcrypt.compareSync(plaintext, hash);
}

function createToken(userId, username) {
  return jwt.sign({ userId, username }, SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = decoded;
  next();
}

module.exports = { hashPassword, verifyPassword, createToken, verifyToken, requireAuth };
