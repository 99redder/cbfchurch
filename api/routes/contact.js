const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const QUICK_MESSAGE_FROM = process.env.QUICK_MESSAGE_FROM || 'noreply@cbfchurch.com';

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

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 8;
const ipHits = new Map();

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function isEmail(v) {
  const value = normalizeEmail(v);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// "Are you a human?" check. The challenge is stateless: the token is signed with
// the answer mixed in, so the server only has to remember which tokens were used.
const HUMAN_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const HUMAN_MIN_AGE_MS = 2 * 1000; // bots submit instantly; people don't
const HUMAN_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const usedChallenges = new Map(); // nonce -> expiresAt

function signChallenge(body, answer) {
  return crypto.createHmac('sha256', HUMAN_SECRET).update(`${body}|${answer}`).digest('base64url');
}

function createChallenge() {
  const a = crypto.randomInt(1, 10);
  const b = crypto.randomInt(1, 10);
  const body = Buffer.from(JSON.stringify({
    iat: Date.now(),
    n: crypto.randomBytes(9).toString('base64url')
  })).toString('base64url');
  return { question: `${a} + ${b}`, token: `${body}.${signChallenge(body, a + b)}` };
}

// Returns null when the check passes, otherwise the error to show. Each token
// gets a single guess, so a wrong answer burns it and the page asks a new one.
function checkHuman(token, answer) {
  const failed = 'Please answer the "are you a human" question and try again.';
  const [body, sig] = String(token || '').split('.');
  const guess = String(answer ?? '').trim();
  if (!body || !sig || !/^\d{1,2}$/.test(guess)) return failed;

  let data;
  try {
    data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (err) {
    return failed;
  }
  if (!data || typeof data.iat !== 'number' || typeof data.n !== 'string') return failed;

  const now = Date.now();
  const age = now - data.iat;
  if (age > HUMAN_MAX_AGE_MS || usedChallenges.has(data.n)) {
    return 'That "are you a human" question expired. Please answer the new one.';
  }
  if (age < HUMAN_MIN_AGE_MS) return 'Please wait a moment and try again.';

  for (const [nonce, expiresAt] of usedChallenges) {
    if (now > expiresAt) usedChallenges.delete(nonce);
  }
  usedChallenges.set(data.n, data.iat + HUMAN_MAX_AGE_MS);

  const expected = Buffer.from(signChallenge(body, Number(guess)));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return 'That answer was not correct. Please try the new question.';
  }
  return null;
}

function isRateLimited(ip) {
  const now = Date.now();
  const row = ipHits.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > row.resetAt) {
    row.count = 0;
    row.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  row.count += 1;
  ipHits.set(ip, row);
  return row.count > RATE_LIMIT_MAX;
}

router.get('/challenge', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(createChallenge());
});

router.post('/quick-message', async (req, res) => {
  try {
    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: 'Email service is not configured on the server.' });
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (isRateLimited(String(ip))) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a few minutes.' });
    }

    // Honeypot: the field is hidden from people, so only a bot fills it in.
    // Report success so the bot has no reason to adapt.
    if (String(req.body?.website || '').trim()) {
      return res.json({ message: 'Message sent.', id: null });
    }

    const fromName = String(req.body?.fromName || '').trim().slice(0, 120);
    const replyToInput = normalizeEmail(req.body?.replyTo);
    const to = normalizeEmail(req.body?.to);
    const phone = String(req.body?.phone || '').trim().slice(0, 40);
    const ccRaw = req.body?.cc;
    const ccList = Array.isArray(ccRaw) ? ccRaw.map(normalizeEmail).filter(Boolean) : (ccRaw ? [normalizeEmail(ccRaw)] : []);
    const subject = String(req.body?.subject || '').trim().slice(0, 200);
    const message = String(req.body?.message || '').trim().slice(0, 5000);

    if (!fromName || !isEmail(replyToInput) || !isEmail(to) || !subject || !message) {
      return res.status(400).json({ error: 'Your Name, Your Email Address, To, Subject, and Message are required.' });
    }

    if (ccList.some(v => !isEmail(v))) {
      return res.status(400).json({ error: 'CC must contain valid email addresses.' });
    }

    if (ccList.some(v => !ALLOWED_RECIPIENTS.has(v))) {
      return res.status(400).json({ error: 'CC recipient is not allowed.' });
    }

    if (!ALLOWED_RECIPIENTS.has(to)) {
      return res.status(400).json({ error: 'Selected recipient is not allowed.' });
    }

    const humanError = checkHuman(req.body?.humanToken, req.body?.humanAnswer);
    if (humanError) {
      return res.status(400).json({ error: humanError, newChallenge: true });
    }

    const replyToList = [replyToInput];

    const payload = {
      from: `CBF Website Messenger <${QUICK_MESSAGE_FROM}>`,
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
      reply_to: replyToList,
      headers: {
        'X-Source': 'cbfchurch-contact-quick-message'
      }
    };

    if (ccList.length) payload.cc = ccList;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error('Resend send error:', resendRes.status, data);
      return res.status(502).json({ error: data?.message || 'Email provider rejected the request.' });
    }

    return res.json({ message: 'Message sent.', id: data?.id || null });
  } catch (err) {
    console.error('Quick message send error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
