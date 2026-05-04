const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.SESSION_SECRET || '';
const TOKEN_EXPIRY = '12h';

if (process.env.NODE_ENV === 'production' && !SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}

function hashPassword(plaintext) {
  return bcrypt.hashSync(plaintext, 10);
}

function verifyPassword(plaintext, hash) {
  return bcrypt.compareSync(plaintext, hash);
}

function createToken(userId, username, role) {
  if (!SECRET) throw new Error('SESSION_SECRET is not configured');
  return jwt.sign({ userId, username, role }, SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    if (!SECRET) return null;
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  let token = req.cookies?.token;
  // Also accept Authorization: Bearer <token> header (for cross-origin without cookies)
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }
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

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

module.exports = { hashPassword, verifyPassword, createToken, verifyToken, requireAuth, requireSuperAdmin };
