const express = require('express');
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

// "Are you a human?" check: Cloudflare Turnstile. The browser gets a one-time
// token from the widget and we confirm it with Cloudflare before sending.
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || '';
const TURNSTILE_ACTION = 'contact';
const TURNSTILE_HOSTNAMES = new Set(
  (process.env.TURNSTILE_HOSTNAMES || 'www.cbfchurch.com,cbfchurch.com')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean)
);

// Fails closed: any problem reaching or reading siteverify counts as not human.
async function isHuman(token, ip) {
  if (!TURNSTILE_SECRET || typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip })
    });
    if (!r.ok) throw new Error(`siteverify ${r.status}`);
    const result = await r.json();
    if (!result.success) console.warn('Turnstile rejected token:', result['error-codes']);
    return result.success === true &&
      result.action === TURNSTILE_ACTION &&
      TURNSTILE_HOSTNAMES.has(String(result.hostname || '').toLowerCase());
  } catch (err) {
    console.error('Turnstile siteverify error:', err);
    return false;
  }
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

    if (!(await isHuman(req.body?.turnstileToken, String(ip)))) {
      return res.status(403).json({ error: 'We could not confirm you are human. Please complete the check above the Send button and try again.' });
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
