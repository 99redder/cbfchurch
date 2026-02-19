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

    const fromInput = normalizeEmail(req.body?.from);
    const replyToInput = normalizeEmail(req.body?.replyTo);
    const to = normalizeEmail(req.body?.to);
    const cc = normalizeEmail(req.body?.cc);
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();

    if (!isEmail(fromInput) || !isEmail(replyToInput) || !isEmail(to) || !subject || !message) {
      return res.status(400).json({ error: 'From, Reply-To, To, Subject, and Message are required.' });
    }

    if (cc && !isEmail(cc)) {
      return res.status(400).json({ error: 'CC must be a valid email address.' });
    }

    if (!ALLOWED_RECIPIENTS.has(to)) {
      return res.status(400).json({ error: 'Selected recipient is not allowed.' });
    }

    const replyToList = Array.from(new Set([replyToInput, fromInput].filter(Boolean)));

    const payload = {
      from: `CBF Website Messenger <${QUICK_MESSAGE_FROM}>`,
      to: [to],
      subject,
      text: [
        `From (submitted): ${fromInput}`,
        `Reply-To (submitted): ${replyToInput}`,
        cc ? `CC requested: ${cc}` : '',
        '',
        message
      ].filter(Boolean).join('\n'),
      reply_to: replyToList,
      headers: {
        'X-Source': 'cbfchurch-contact-quick-message'
      }
    };

    if (cc) payload.cc = [cc];

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
