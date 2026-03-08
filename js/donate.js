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
  const resultOverlay = document.getElementById('donation-result-overlay');
  const resultTitle = document.getElementById('donation-result-title');
  const resultMessage = document.getElementById('donation-result-message');
  const resultPrimary = document.getElementById('donation-result-primary');
  const resultSecondary = document.getElementById('donation-result-secondary');
  const resultClose = document.getElementById('donation-result-close');

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

  function showResult(kind) {
    if (!resultOverlay || !resultTitle || !resultMessage) return;
    if (kind === 'paid') {
      resultTitle.textContent = 'Thank You for Your Gift';
      resultTitle.style.color = 'var(--color-primary)';
      resultMessage.textContent = 'Your donation was processed successfully. We appreciate your support of Christian Believers Fellowship.';
      if (resultPrimary) {
        resultPrimary.textContent = 'Continue';
        resultPrimary.href = 'donate.html';
      }
      if (resultSecondary) {
        resultSecondary.textContent = 'Visit Home';
        resultSecondary.href = 'index.html';
      }
    } else {
      resultTitle.textContent = 'Donation Checkout Canceled';
      resultTitle.style.color = '#dc3545';
      resultMessage.textContent = 'No charge was made. You can return and complete your donation whenever you are ready.';
      if (resultPrimary) {
        resultPrimary.textContent = 'Try Again';
        resultPrimary.href = 'donate.html';
      }
      if (resultSecondary) {
        resultSecondary.textContent = 'Contact Us';
        resultSecondary.href = 'contact.html';
      }
    }
    resultOverlay.style.display = 'flex';
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('paid') === '1') {
    setStatus('Thank you! Your donation was successful.', 'success');
    showResult('paid');
    params.delete('paid');
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', clean);
  } else if (params.get('canceled') === '1') {
    setStatus('Donation checkout canceled. You can try again any time.');
    showResult('canceled');
    params.delete('canceled');
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', clean);
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

  function closeResultOverlay() {
    if (resultOverlay) resultOverlay.style.display = 'none';
  }

  resultClose?.addEventListener('click', closeResultOverlay);
  resultOverlay?.addEventListener('click', (e) => {
    if (e.target === resultOverlay) closeResultOverlay();
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
