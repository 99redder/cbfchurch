import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const TOKEN_EXPIRY = '12h';

// Same bcrypt hashes as the Render API, so accounts work on either one
export function hashPassword(plaintext) {
  return bcrypt.hashSync(plaintext, 10);
}

export function verifyPassword(plaintext, hash) {
  return bcrypt.compareSync(plaintext, hash);
}

function secretKey(env) {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not configured');
  return new TextEncoder().encode(env.SESSION_SECRET);
}

// HS256 with the same secret as the Render API, so tokens from either work on both
export async function createToken(env, userId, username, role) {
  return new SignJWT({ userId, username, role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secretKey(env));
}

export async function verifyToken(env, token) {
  try {
    if (!env.SESSION_SECRET) return null;
    const { payload } = await jwtVerify(token, secretKey(env), { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}
