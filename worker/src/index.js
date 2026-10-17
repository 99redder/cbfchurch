// CBF church API on Cloudflare Workers — a port of the Express app in ../api.
// Same routes, same responses, same Neon database and R2 bucket.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import sanitizeHtml from 'sanitize-html';
import { createDb } from './db.js';
import { hashPassword, verifyPassword, createToken, verifyToken } from './auth.js';

const app = new Hono();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use('*', async (c, next) => {
  c.set('db', createDb(c.env.DATABASE_URL));
  await next();
});

app.use('*', secureHeaders({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

app.use('*', (c, next) => {
  const allowedOrigins = String(c.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  return cors({
    origin: origin => (allowedOrigins.includes(origin) ? origin : null),
    credentials: true
  })(c, next);
});

app.use('/api/*', bodyLimit({
  maxSize: 5 * 1024 * 1024,
  onError: c => c.json({ error: 'Request body too large' }, 413)
}));

// Best-effort rate limiting. Counters live in the Worker isolate's memory, so
// they reset whenever Cloudflare recycles it and aren't shared between
// locations — enough to slow down a single noisy client.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return async (c, next) => {
    const ip = clientIp(c);
    const now = Date.now();
    let row = hits.get(ip);
    if (!row || now > row.resetAt) {
      row = { count: 0, resetAt: now + windowMs };
      hits.set(ip, row);
    }
    row.count += 1;
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    if (row.count > max) return c.json(message, 429);
    await next();
  };
}

function clientIp(c) {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
}

app.use('/api/*', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { error: 'Too many requests, please try again later.' } }));

async function readJson(c) {
  try {
    return (await c.req.json()) || {};
  } catch {
    return {};
  }
}

async function requireAuth(c, next) {
  let token = getCookie(c, 'token');
  // Also accept Authorization: Bearer <token> (cross-origin without cookies)
  const authHeader = c.req.header('authorization');
  if (!token && authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') token = parts[1];
  }
  if (!token) return c.json({ error: 'Authentication required' }, 401);
  const decoded = await verifyToken(c.env, token);
  if (!decoded) return c.json({ error: 'Invalid or expired token' }, 401);
  c.set('user', decoded);
  await next();
}

async function requireSuperAdmin(c, next) {
  if (c.get('user').role !== 'superadmin') {
    return c.json({ error: 'Super admin access required' }, 403);
  }
  await next();
}

function serverError(c, label, err) {
  console.error(`${label}:`, err);
  return c.json({ error: 'Internal server error' }, 500);
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/api/health', c => c.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

app.post('/api/auth/login', loginLimiter, async c => {
  try {
    const db = c.get('db');
    const { username, password } = await readJson(c);
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!normalizedUsername || !password) {
      return c.json({ error: 'Username and password are required' }, 400);
    }

    const user = await db.get('SELECT * FROM users WHERE username = $1', [normalizedUsername]);
    if (!user || !verifyPassword(String(password), user.password_hash)) {
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    const token = await createToken(c.env, user.id, user.username, user.role);
    setCookie(c, 'token', token, { httpOnly: true, secure: true, sameSite: 'None', path: '/', maxAge: 24 * 60 * 60 });
    return c.json({ message: 'Login successful', username: user.username, token });
  } catch (err) {
    return serverError(c, 'Login error', err);
  }
});

app.post('/api/auth/logout', c => {
  deleteCookie(c, 'token', { httpOnly: true, secure: true, sameSite: 'None', path: '/' });
  return c.json({ message: 'Logged out' });
});

app.post('/api/auth/register', requireAuth, requireSuperAdmin, async c => {
  try {
    const db = c.get('db');
    const { username, password, role } = await readJson(c);
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!normalizedUsername || !password) {
      return c.json({ error: 'Username and password are required' }, 400);
    }
    if (String(password).length < 12) {
      return c.json({ error: 'Password must be at least 12 characters' }, 400);
    }
    if (!/^[a-z0-9._-]{3,64}$/.test(normalizedUsername)) {
      return c.json({ error: 'Username must be 3-64 characters and use letters, numbers, dots, underscores, or hyphens.' }, 400);
    }

    const userRole = ['admin', 'superadmin'].includes(role) ? role : 'admin';

    const existing = await db.get('SELECT id FROM users WHERE username = $1', [normalizedUsername]);
    if (existing) return c.json({ error: 'Username already exists' }, 409);

    const hash = hashPassword(String(password));
    const result = await db.run(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
      [normalizedUsername, hash, userRole]
    );

    return c.json({ message: 'Admin account created', id: result.lastInsertId }, 201);
  } catch (err) {
    return serverError(c, 'Register error', err);
  }
});

app.get('/api/auth/me', requireAuth, c => {
  const user = c.get('user');
  return c.json({ username: user.username, userId: user.userId, role: user.role });
});

// ---------------------------------------------------------------------------
// Public posts
// ---------------------------------------------------------------------------

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

app.get('/api/posts', async c => {
  try {
    const db = c.get('db');
    const page = Math.max(1, parseInt(c.req.query('page')) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(c.req.query('limit')) || 5));
    const offset = (page - 1) * limit;

    const posts = await db.all(
      'SELECT id, title, content, author, slug, created_at, updated_at FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const countRow = await db.get('SELECT COUNT(*) as count FROM posts');
    const count = countRow ? parseInt(countRow.count) : 0;

    return c.json({
      posts: posts.map(p => ({ ...p, preview: stripHtml(p.content).substring(0, 250) })),
      page,
      totalPages: Math.ceil(count / limit),
      totalPosts: count
    });
  } catch (err) {
    return serverError(c, 'Get posts error', err);
  }
});

app.get('/api/posts/archives', async c => {
  try {
    const archives = await c.get('db').all(`
      SELECT
        EXTRACT(YEAR FROM created_at)::text as year,
        LPAD(EXTRACT(MONTH FROM created_at)::text, 2, '0') as month,
        COUNT(*)::int as count
      FROM posts
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `);
    return c.json(archives);
  } catch (err) {
    return serverError(c, 'Get archives error', err);
  }
});

app.get('/api/posts/:slug', async c => {
  try {
    const post = await c.get('db').get(
      'SELECT id, title, content, author, slug, created_at, updated_at FROM posts WHERE slug = $1',
      [c.req.param('slug')]
    );
    if (!post) return c.json({ error: 'Post not found' }, 404);
    return c.json(post);
  } catch (err) {
    return serverError(c, 'Get post error', err);
  }
});

// ---------------------------------------------------------------------------
// Gallery (public) + R2 storage
// ---------------------------------------------------------------------------

function publicUrl(env, key) {
  const base = String(env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  return base ? `${base}/${key}` : '';
}

function attachPublicUrl(env, photo) {
  if (!photo || photo.url || !photo.storage_key) return photo;
  return { ...photo, url: publicUrl(env, photo.storage_key) };
}

app.get('/api/gallery', async c => {
  try {
    const photos = await c.get('db').all(
      'SELECT id, filename, alt, created_at, storage_key, url FROM gallery_photos ORDER BY position ASC, created_at DESC'
    );
    return c.json(photos.map(p => attachPublicUrl(c.env, p)));
  } catch (err) {
    return serverError(c, 'Get gallery photos error', err);
  }
});

// ---------------------------------------------------------------------------
// Site content (public)
// ---------------------------------------------------------------------------

app.get('/api/content/:key', async c => {
  try {
    const key = String(c.req.param('key') || '').trim();
    if (!key) return c.json({ error: 'Content key is required' }, 400);
    const row = await c.get('db').get('SELECT key, value_json, updated_at FROM site_content WHERE key = $1', [key]);
    if (!row) return c.json({ key, value: null });
    return c.json({ key: row.key, value: row.value_json, updatedAt: row.updated_at });
  } catch (err) {
    return serverError(c, 'Get site content error', err);
  }
});

// ---------------------------------------------------------------------------
// Admin (JWT required)
// ---------------------------------------------------------------------------

const admin = new Hono();
admin.use('*', requireAuth);

function sanitizePostContent(content) {
  return sanitizeHtml(String(content || ''), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'ol', 'ul', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'pre', 'code'],
    allowedAttributes: { a: ['href', 'name', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) }
  }).trim();
}

function generateSlug(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function hasValidImageSignature(bytes, mime) {
  if (bytes.length < 12) return false;
  const starts = sig => sig.every((b, i) => bytes[i] === b);
  const ascii = (from, to) => String.fromCharCode(...bytes.subarray(from, to));
  if (mime === 'image/png') return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }
  if (mime === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  return false;
}

admin.get('/posts', async c => {
  try {
    const posts = await c.get('db').all(
      'SELECT id, title, author, slug, created_at, updated_at FROM posts ORDER BY created_at DESC'
    );
    return c.json(posts);
  } catch (err) {
    return serverError(c, 'Admin get posts error', err);
  }
});

admin.post('/posts', async c => {
  try {
    const db = c.get('db');
    const { title, content, author } = await readJson(c);
    const cleanContent = sanitizePostContent(content);
    if (!title || !cleanContent || !author) {
      return c.json({ error: 'Title, content, and author are required' }, 400);
    }

    const slug = generateSlug(title);
    const existing = await db.get('SELECT id FROM posts WHERE slug = $1', [slug]);
    if (existing) return c.json({ error: 'A post with a similar title already exists' }, 409);

    const result = await db.run(
      'INSERT INTO posts (title, content, author, slug) VALUES ($1, $2, $3, $4) RETURNING id',
      [String(title).trim().slice(0, 200), cleanContent, String(author).trim().slice(0, 120), slug]
    );
    return c.json({ message: 'Post created', id: result.lastInsertId, slug }, 201);
  } catch (err) {
    return serverError(c, 'Create post error', err);
  }
});

admin.put('/posts/:id', async c => {
  try {
    const db = c.get('db');
    const { title, content, author } = await readJson(c);
    const cleanContent = sanitizePostContent(content);
    if (!title || !cleanContent || !author) {
      return c.json({ error: 'Title, content, and author are required' }, 400);
    }

    const id = parseInt(c.req.param('id'));
    const post = await db.get('SELECT id FROM posts WHERE id = $1', [id]);
    if (!post) return c.json({ error: 'Post not found' }, 404);

    const slug = generateSlug(title);
    const conflict = await db.get('SELECT id FROM posts WHERE slug = $1 AND id != $2', [slug, id]);
    if (conflict) return c.json({ error: 'A post with a similar title already exists' }, 409);

    await db.run(
      'UPDATE posts SET title = $1, content = $2, author = $3, slug = $4, updated_at = NOW() WHERE id = $5',
      [String(title).trim().slice(0, 200), cleanContent, String(author).trim().slice(0, 120), slug, id]
    );
    return c.json({ message: 'Post updated', slug });
  } catch (err) {
    return serverError(c, 'Update post error', err);
  }
});

admin.delete('/posts/:id', async c => {
  try {
    const db = c.get('db');
    const id = parseInt(c.req.param('id'));
    const post = await db.get('SELECT id FROM posts WHERE id = $1', [id]);
    if (!post) return c.json({ error: 'Post not found' }, 404);
    await db.run('DELETE FROM posts WHERE id = $1', [id]);
    return c.json({ message: 'Post deleted' });
  } catch (err) {
    return serverError(c, 'Delete post error', err);
  }
});

admin.get('/posts/:id', async c => {
  try {
    const post = await c.get('db').get('SELECT * FROM posts WHERE id = $1', [parseInt(c.req.param('id'))]);
    if (!post) return c.json({ error: 'Post not found' }, 404);
    return c.json(post);
  } catch (err) {
    return serverError(c, 'Admin get post error', err);
  }
});

admin.get('/users', requireSuperAdmin, async c => {
  try {
    const users = await c.get('db').all('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC');
    return c.json(users);
  } catch (err) {
    return serverError(c, 'Admin get users error', err);
  }
});

admin.delete('/users/:id', requireSuperAdmin, async c => {
  try {
    const db = c.get('db');
    const id = parseInt(c.req.param('id'));
    if (id === c.get('user').userId) {
      return c.json({ error: 'You cannot delete your own account' }, 400);
    }
    const user = await db.get('SELECT id FROM users WHERE id = $1', [id]);
    if (!user) return c.json({ error: 'User not found' }, 404);
    await db.run('DELETE FROM users WHERE id = $1', [id]);
    return c.json({ message: 'User deleted' });
  } catch (err) {
    return serverError(c, 'Delete user error', err);
  }
});

admin.post('/gallery', async c => {
  try {
    const { imageData, alt } = await readJson(c);
    if (!imageData || typeof imageData !== 'string') {
      return c.json({ error: 'Image data is required' }, 400);
    }

    const match = imageData.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
    if (!match) return c.json({ error: 'Invalid image format' }, 400);

    const mime = match[1].toLowerCase();
    const ext = mime.includes('jpeg') ? 'jpg' : mime.split('/')[1];
    let bytes;
    try {
      bytes = Uint8Array.from(atob(match[3]), ch => ch.charCodeAt(0));
    } catch {
      return c.json({ error: 'Invalid image format' }, 400);
    }

    if (!hasValidImageSignature(bytes, mime)) {
      return c.json({ error: 'Uploaded file is not a valid image.' }, 400);
    }
    if (bytes.length > 4 * 1024 * 1024) {
      return c.json({ error: 'Image too large (max 4MB)' }, 413);
    }

    const suffix = [...crypto.getRandomValues(new Uint8Array(3))].map(b => b.toString(16).padStart(2, '0')).join('');
    const filename = `gallery-${Date.now()}-${suffix}.${ext}`;
    const storageKey = `gallery/${filename}`;
    await c.env.GALLERY.put(storageKey, bytes, { httpMetadata: { contentType: mime } });
    const url = publicUrl(c.env, storageKey);

    const result = await c.get('db').run(
      'INSERT INTO gallery_photos (filename, alt, position, storage_key, url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [filename, String(alt || '').trim().slice(0, 200), 0, storageKey, url]
    );

    return c.json({ message: 'Photo uploaded', id: result.lastInsertId, filename, url: url || '' }, 201);
  } catch (err) {
    return serverError(c, 'Upload gallery photo error', err);
  }
});

admin.get('/gallery', async c => {
  try {
    const photos = await c.get('db').all(
      'SELECT id, filename, alt, position, created_at, storage_key, url FROM gallery_photos ORDER BY position ASC, created_at DESC'
    );
    return c.json(photos.map(p => attachPublicUrl(c.env, p)));
  } catch (err) {
    return serverError(c, 'Admin get gallery photos error', err);
  }
});

admin.put('/gallery/reorder', async c => {
  try {
    const db = c.get('db');
    const { orderedIds } = await readJson(c);
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return c.json({ error: 'orderedIds is required' }, 400);
    }
    for (let i = 0; i < orderedIds.length; i++) {
      const id = parseInt(orderedIds[i]);
      if (Number.isNaN(id)) continue;
      await db.run('UPDATE gallery_photos SET position = $1 WHERE id = $2', [i + 1, id]);
    }
    return c.json({ message: 'Gallery order updated' });
  } catch (err) {
    return serverError(c, 'Reorder gallery photos error', err);
  }
});

admin.delete('/gallery/:id', async c => {
  try {
    const db = c.get('db');
    const id = parseInt(c.req.param('id'));
    const photo = await db.get('SELECT filename, storage_key FROM gallery_photos WHERE id = $1', [id]);
    if (!photo) return c.json({ error: 'Photo not found' }, 404);

    await db.run('DELETE FROM gallery_photos WHERE id = $1', [id]);
    // Photos uploaded to Render's disk (no storage_key) are already gone
    if (photo.storage_key) {
      try {
        await c.env.GALLERY.delete(photo.storage_key);
      } catch (err) {
        console.error('Failed to delete R2 object:', err);
      }
    }
    return c.json({ message: 'Photo deleted' });
  } catch (err) {
    return serverError(c, 'Delete gallery photo error', err);
  }
});

admin.put('/site-content/:key', async c => {
  try {
    const key = String(c.req.param('key') || '').trim();
    const { value } = await readJson(c);
    if (!key) return c.json({ error: 'Content key is required' }, 400);
    if (!value || typeof value !== 'object') {
      return c.json({ error: 'value object is required' }, 400);
    }
    if (!['beliefs', 'history'].includes(key)) {
      return c.json({ error: 'This content key is not editable.' }, 400);
    }

    await c.get('db').run(
      `INSERT INTO site_content (key, value_json, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
    return c.json({ message: 'Content saved', key });
  } catch (err) {
    return serverError(c, 'Update site content error', err);
  }
});

app.route('/api/admin', admin);

// ---------------------------------------------------------------------------
// Contact quick message (Turnstile + Resend)
// ---------------------------------------------------------------------------

// Strict recipient allowlist from Detailed Contact List page (+ web admin support)
const ALLOWED_RECIPIENTS = new Set([
  'dennisgorham@comcast.net',
  'bblake351@gmail.com',
  'leavittrichard49@gmail.com',
  'deniseleavitt52@gmail.com',
  'cbf-somersworthnh@hotmail.com',
  'stevefayehoffner@hotmail.com',
  'hoffnerjustinb1@gmail.com',
  'sblake4588@gmail.com',
  'cynthia.choate@gmail.com',
  'tdomosiaris@comcast.net',
  'hrhopkinson@gmail.com',
  'rimaro@metrocast.net',
  'support@easternshore.ai'
]);

const TURNSTILE_ACTION = 'contact';

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(v));
}

// Fails closed: any problem reaching or reading siteverify counts as not human.
async function isHuman(env, token, ip) {
  const secret = env.TURNSTILE_SECRET || '';
  if (!secret || typeof token !== 'string' || !token || token.length > 2048) return false;
  const hostnames = new Set(
    String(env.TURNSTILE_HOSTNAMES || 'www.cbfchurch.com,cbfchurch.com')
      .split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
  );
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ secret, response: token, remoteip: ip })
    });
    if (!r.ok) throw new Error(`siteverify ${r.status}`);
    const result = await r.json();
    if (!result.success) console.warn('Turnstile rejected token:', result['error-codes']);
    return result.success === true &&
      result.action === TURNSTILE_ACTION &&
      hostnames.has(String(result.hostname || '').toLowerCase());
  } catch (err) {
    console.error('Turnstile siteverify error:', err);
    return false;
  }
}

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: { error: 'Too many requests. Please try again in a few minutes.' }
});

app.post('/api/contact/quick-message', contactLimiter, async c => {
  try {
    const resendKey = c.env.RESEND_API_KEY || '';
    if (!resendKey) {
      return c.json({ error: 'Email service is not configured on the server.' }, 500);
    }

    const body = await readJson(c);

    // Honeypot: the field is hidden from people, so only a bot fills it in.
    // Report success so the bot has no reason to adapt.
    if (String(body.website || '').trim()) {
      return c.json({ message: 'Message sent.', id: null });
    }

    const fromName = String(body.fromName || '').trim().slice(0, 120);
    const replyToInput = normalizeEmail(body.replyTo);
    const to = normalizeEmail(body.to);
    const phone = String(body.phone || '').trim().slice(0, 40);
    const ccRaw = body.cc;
    const ccList = Array.isArray(ccRaw) ? ccRaw.map(normalizeEmail).filter(Boolean) : (ccRaw ? [normalizeEmail(ccRaw)] : []);
    const subject = String(body.subject || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 5000);

    if (!fromName || !isEmail(replyToInput) || !isEmail(to) || !subject || !message) {
      return c.json({ error: 'Your Name, Your Email Address, To, Subject, and Message are required.' }, 400);
    }
    if (ccList.some(v => !isEmail(v))) {
      return c.json({ error: 'CC must contain valid email addresses.' }, 400);
    }
    if (ccList.some(v => !ALLOWED_RECIPIENTS.has(v))) {
      return c.json({ error: 'CC recipient is not allowed.' }, 400);
    }
    if (!ALLOWED_RECIPIENTS.has(to)) {
      return c.json({ error: 'Selected recipient is not allowed.' }, 400);
    }

    if (!(await isHuman(c.env, body.turnstileToken, clientIp(c)))) {
      return c.json({ error: 'We could not confirm you are human. Please complete the check above the Send button and try again.' }, 403);
    }

    const payload = {
      from: `CBF Website Messenger <${c.env.QUICK_MESSAGE_FROM || 'noreply@cbfchurch.com'}>`,
      to: [to],
      subject,
      text: [
        `From Name: ${fromName}`,
        `Reply-To (submitted): ${replyToInput}`,
        phone ? `Phone (submitted): ${phone}` : '',
        ccList.length ? `CC requested: ${ccList.join(', ')}` : '',
        '',
        message
      ].filter(Boolean).join('\n'),
      reply_to: [replyToInput],
      headers: { 'X-Source': 'cbfchurch-contact-quick-message' }
    };
    if (ccList.length) payload.cc = ccList;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error('Resend send error:', resendRes.status, data);
      return c.json({ error: data?.message || 'Email provider rejected the request.' }, 502);
    }
    return c.json({ message: 'Message sent.', id: data?.id || null });
  } catch (err) {
    console.error('Quick message send error:', err);
    return c.json({ error: 'Internal server error.' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Donations (Stripe Checkout)
// ---------------------------------------------------------------------------

const donationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { error: 'Too many donation attempts. Please try again shortly.' }
});

app.post('/api/donations/checkout-session', donationLimiter, async c => {
  try {
    const stripeSecret = String(c.env.STRIPE_SECRET_KEY || '').trim();
    if (!stripeSecret) {
      return c.json({ error: 'Stripe is not configured on the server.' }, 500);
    }

    const input = await readJson(c);
    const amountCents = parseInt(input.amountCents, 10);
    const frequency = String(input.frequency || 'one_time').trim(); // one_time|monthly|yearly
    const donorName = String(input.name || '').trim().slice(0, 120);
    const donorEmail = String(input.email || '').trim().toLowerCase();

    if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 5000000) {
      return c.json({ error: 'Donation amount must be between $1.00 and $50,000.00.' }, 400);
    }
    if (!['one_time', 'monthly', 'yearly'].includes(frequency)) {
      return c.json({ error: 'Invalid donation frequency.' }, 400);
    }
    if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
      return c.json({ error: 'Please enter a valid email address.' }, 400);
    }

    const siteOrigin = String(c.env.DONATION_SITE_ORIGIN || '').trim() ||
      String(c.req.header('origin') || '').trim() ||
      'https://www.cbfchurch.com';
    // The mobile home page has its own giving widget. When the request comes
    // from there (source=home), send a cancel back to that widget instead of
    // the full donate page. `source` only selects between hardcoded
    // same-origin paths, so it can't be used for open redirects.
    const fromHome = String(input.source || '').trim() === 'home';
    const successUrl = `${siteOrigin}/donate.html?paid=1`;
    const cancelUrl = fromHome
      ? `${siteOrigin}/index.html?canceled=1#donate`
      : `${siteOrigin}/donate.html?canceled=1`;

    const body = new URLSearchParams({
      mode: frequency === 'one_time' ? 'payment' : 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(amountCents),
      'line_items[0][price_data][product_data][name]': 'Christian Believers Fellowship Donation',
      'line_items[0][price_data][product_data][description]': frequency === 'one_time'
        ? 'One-time donation'
        : (frequency === 'monthly' ? 'Monthly recurring donation' : 'Yearly recurring donation'),
      'metadata[donation_frequency]': frequency,
      'metadata[donor_name]': donorName,
      'metadata[donor_email]': donorEmail
    });
    if (frequency === 'monthly' || frequency === 'yearly') {
      body.set('line_items[0][price_data][recurring][interval]', frequency === 'monthly' ? 'month' : 'year');
    }
    if (donorEmail) body.set('customer_email', donorEmail);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeSecret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const stripeData = await stripeRes.json().catch(() => ({}));
    if (!stripeRes.ok || !stripeData?.url) {
      console.error('Donation checkout creation failed:', stripeRes.status, stripeData);
      return c.json({ error: stripeData?.error?.message || 'Unable to create donation checkout.' }, 502);
    }
    return c.json({ checkoutUrl: stripeData.url, id: stripeData.id });
  } catch (err) {
    console.error('Donation checkout error:', err);
    return c.json({ error: 'Internal server error.' }, 500);
  }
});

app.notFound(c => c.json({ error: 'Not found' }, 404));

export default app;
