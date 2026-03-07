const express = require('express');
const router = express.Router();

function getOrigin(req) {
  const origin = String(req.headers.origin || '').trim();
  if (origin) return origin;
  const host = String(req.headers.host || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').trim();
  return host ? `${proto}://${host}` : '';
}

router.post('/checkout-session', async (req, res) => {
  try {
    const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!stripeSecret) {
      return res.status(500).json({ error: 'Stripe is not configured on the server.' });
    }

    const amountCents = parseInt(req.body?.amountCents, 10);
    const frequency = String(req.body?.frequency || 'one_time').trim(); // one_time|monthly|yearly
    const donorName = String(req.body?.name || '').trim();
    const donorEmail = String(req.body?.email || '').trim();

    if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 5000000) {
      return res.status(400).json({ error: 'Donation amount must be between $1.00 and $50,000.00.' });
    }

    if (!['one_time', 'monthly', 'yearly'].includes(frequency)) {
      return res.status(400).json({ error: 'Invalid donation frequency.' });
    }

    const siteOrigin = String(process.env.DONATION_SITE_ORIGIN || '').trim() || getOrigin(req) || 'https://www.cbfchurch.com';
    const successUrl = `${siteOrigin}/donate.html?paid=1`;
    const cancelUrl = `${siteOrigin}/donate.html?canceled=1`;

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
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const stripeData = await stripeRes.json().catch(() => ({}));
    if (!stripeRes.ok || !stripeData?.url) {
      console.error('Donation checkout creation failed:', stripeRes.status, stripeData);
      return res.status(502).json({ error: stripeData?.error?.message || 'Unable to create donation checkout.' });
    }

    return res.json({ checkoutUrl: stripeData.url, id: stripeData.id });
  } catch (err) {
    console.error('Donation checkout error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
