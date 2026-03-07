(function initDonatePage() {
  const form = document.getElementById('donation-form');
  if (!form) return;

  const frequencyButtons = Array.from(document.querySelectorAll('.freq-btn'));
  const amountButtons = Array.from(document.querySelectorAll('.amount-btn'));
  const amountInput = document.getElementById('donation-amount');
  const statusEl = document.getElementById('donation-status');
  const donateBtn = document.getElementById('donate-btn');
  const nameEl = document.getElementById('donor-name');
  const emailEl = document.getElementById('donor-email');

  let frequency = 'one_time';

  function setStatus(message, type = 'error') {
    if (!statusEl) return;
    if (!message) {
      statusEl.style.display = 'none';
      statusEl.textContent = '';
      statusEl.className = 'alert';
      return;
    }
    statusEl.style.display = 'block';
    statusEl.textContent = message;
    statusEl.className = `alert ${type === 'success' ? 'alert-success' : 'alert-error'}`;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('paid') === '1') {
    setStatus('Thank you! Your donation was successful.', 'success');
  } else if (params.get('canceled') === '1') {
    setStatus('Donation checkout canceled. You can try again any time.');
  }

  frequencyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      frequencyButtons.forEach(b => b.classList.remove('active', 'btn-primary'));
      frequencyButtons.forEach(b => b.classList.add('btn-outline'));
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline');
      frequency = btn.dataset.frequency || 'one_time';
    });
  });

  amountButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      amountButtons.forEach(b => b.classList.remove('active', 'btn-primary'));
      amountButtons.forEach(b => b.classList.add('btn-outline'));
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline');
      amountInput.value = btn.dataset.amount || '';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');

    const amount = parseFloat(amountInput.value || '0');
    if (!Number.isFinite(amount) || amount < 1) {
      setStatus('Please enter a valid donation amount of at least $1.00.');
      return;
    }

    const amountCents = Math.round(amount * 100);

    donateBtn.disabled = true;
    donateBtn.textContent = 'Preparing checkout...';

    try {
      const res = await fetch(`${API_BASE}/api/donations/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          frequency,
          name: (nameEl?.value || '').trim(),
          email: (emailEl?.value || '').trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Unable to start donation checkout.');
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setStatus(err.message || 'Unable to start donation checkout.');
      donateBtn.disabled = false;
      donateBtn.textContent = 'Continue to Secure Checkout';
    }
  });
})();
