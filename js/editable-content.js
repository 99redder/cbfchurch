(function initEditableContent() {
  const root = document.querySelector('[data-editable-content-key]');
  if (!root) return;

  const contentKey = root.getAttribute('data-editable-content-key');
  const fields = Array.from(root.querySelectorAll('[data-content-field]'));
  if (!contentKey || !fields.length) return;

  const token = localStorage.getItem('cbf_token') || '';

  const controlsWrap = document.createElement('div');
  controlsWrap.style.display = 'none';
  controlsWrap.style.margin = '0 0 1rem';
  controlsWrap.innerHTML = `
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
      <button type="button" id="content-edit-toggle" class="btn btn-outline">Edit Content</button>
      <button type="button" id="content-save" class="btn btn-primary" style="display:none;">Save Changes</button>
      <button type="button" id="content-cancel" class="btn btn-outline" style="display:none;">Cancel</button>
      <span id="content-edit-status" style="font-size:.9rem;color:#4a7fb5;"></span>
    </div>
  `;
  root.prepend(controlsWrap);

  const toggleBtn = controlsWrap.querySelector('#content-edit-toggle');
  const saveBtn = controlsWrap.querySelector('#content-save');
  const cancelBtn = controlsWrap.querySelector('#content-cancel');
  const statusEl = controlsWrap.querySelector('#content-edit-status');

  let editing = false;
  const originalValues = {};

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#dc3545' : '#4a7fb5';
  }

  function sanitizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function setEditing(on) {
    editing = on;
    fields.forEach(el => {
      el.contentEditable = on ? 'true' : 'false';
      el.spellcheck = on;
      if (on) {
        el.style.outline = '2px dashed rgba(74,127,181,0.45)';
        el.style.outlineOffset = '2px';
        el.style.borderRadius = '4px';
      } else {
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.borderRadius = '';
      }
    });

    toggleBtn.style.display = on ? 'none' : 'inline-block';
    saveBtn.style.display = on ? 'inline-block' : 'none';
    cancelBtn.style.display = on ? 'inline-block' : 'none';

    setStatus(on ? 'Edit mode enabled. Text only.' : '');
  }

  function collectPayload() {
    const out = { fields: {} };
    fields.forEach(el => {
      const key = el.getAttribute('data-content-field');
      if (!key) return;
      out.fields[key] = sanitizeText(el.textContent);
    });
    return out;
  }

  function applyPayload(valueObj) {
    if (!valueObj || typeof valueObj !== 'object') return;
    const map = valueObj.fields || {};
    fields.forEach(el => {
      const key = el.getAttribute('data-content-field');
      if (key && Object.prototype.hasOwnProperty.call(map, key)) {
        el.textContent = String(map[key] || '');
      }
    });
  }

  async function loadContent() {
    try {
      const res = await fetch(`${API_BASE}/api/content/${encodeURIComponent(contentKey)}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.value) applyPayload(data.value);
    } catch {
      // best effort only
    }
  }

  async function checkAdmin() {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      return data?.role === 'admin' || data?.role === 'superadmin';
    } catch {
      return false;
    }
  }

  toggleBtn.addEventListener('click', () => {
    fields.forEach(el => {
      const key = el.getAttribute('data-content-field');
      if (key) originalValues[key] = el.textContent;
    });
    setEditing(true);
  });

  cancelBtn.addEventListener('click', () => {
    fields.forEach(el => {
      const key = el.getAttribute('data-content-field');
      if (key && Object.prototype.hasOwnProperty.call(originalValues, key)) {
        el.textContent = originalValues[key];
      }
    });
    setEditing(false);
  });

  saveBtn.addEventListener('click', async () => {
    const payload = collectPayload();
    saveBtn.disabled = true;
    setStatus('Saving...');
    try {
      const res = await fetch(`${API_BASE}/api/admin/site-content/${encodeURIComponent(contentKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ value: payload })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not save content');
      setEditing(false);
      setStatus('Saved successfully.');
    } catch (err) {
      setStatus(err.message || 'Could not save content', true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  loadContent();
  checkAdmin().then((isAdmin) => {
    if (isAdmin) controlsWrap.style.display = 'block';
  });
})();
