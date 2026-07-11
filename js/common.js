// API Configuration
// Change this to your Render.com URL in production
const API_BASE = 'https://cbfchurch.onrender.com';

// Set footer year
const yearEl = document.getElementById('footer-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile nav toggle
// The nav has two <ul class="nav-links"> rows (primary + secondary), so
// toggle every one — otherwise the secondary links (Contact/Donate/Admin)
// stay hidden on mobile.
const navToggle = document.querySelector('.nav-toggle');
const navLinksAll = document.querySelectorAll('.nav-links');
const themeToggle = document.querySelector('.theme-toggle');

if (navToggle && navLinksAll.length) {
  const setNav = (open) => {
    navLinksAll.forEach(ul => ul.classList.toggle('open', open));
    navToggle.setAttribute('aria-expanded', open);
  };

  navToggle.addEventListener('click', () => {
    const willOpen = !navLinksAll[0].classList.contains('open');
    setNav(willOpen);
  });

  // Close nav when clicking a link (mobile)
  navLinksAll.forEach(ul => {
    ul.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => setNav(false));
    });
  });
}

// Theme toggle (dark/light) with system default
const storedTheme = localStorage.getItem('cbf-theme');
if (storedTheme === 'dark' || storedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', storedTheme);
}

if (themeToggle) {
  const updateToggleState = (theme) => {
    themeToggle.setAttribute('aria-pressed', theme === 'dark');
    themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '◐' : '◑';
  };

  const currentTheme = document.documentElement.getAttribute('data-theme');
  updateToggleState(currentTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('cbf-theme', nextTheme);
    updateToggleState(nextTheme);
  });
}

// Highlight current page in nav
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    link.classList.add('active');
  } else {
    link.classList.remove('active');
  }
});

// Utility: format date nicely
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Utility: fetch from API with error handling
async function apiFetch(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Legal modals (Privacy Policy & Terms of Use)
(function initLegalModals() {
  const privacyLink = document.getElementById('privacy-link');
  const termsLink = document.getElementById('terms-link');
  if (!privacyLink && !termsLink) return;

  const privacyContent = `
    <h3>Privacy Policy</h3>
    <p><strong>Last updated:</strong> February 2026</p>
    <p>Christian Believers Fellowship ("CBF," "we," "us," or "our") operates the website www.cbfchurch.com. This Privacy Policy explains how we handle information when you visit our site.</p>

    <h3>Information We Collect</h3>
    <p>Our website is primarily a static informational site. We do not collect personal information from general visitors. We do not use tracking cookies, analytics services, or advertising networks.</p>
    <p>If you contact us via the information provided on our Contact page, any information you share (such as your name or email address) is used solely to respond to your inquiry.</p>

    <h3>Cookies &amp; Local Storage</h3>
    <p>Our site uses browser local storage only to remember your light/dark theme preference. This data stays on your device and is never transmitted to any server.</p>

    <h3>Third-Party Services</h3>
    <p>Our site may embed videos from YouTube. When you view a page containing an embedded video, YouTube may collect information according to their own privacy policy. We encourage you to review YouTube's privacy practices.</p>

    <h3>Children's Privacy</h3>
    <p>Our website is not directed at children under 13, and we do not knowingly collect personal information from children.</p>

    <h3>Changes to This Policy</h3>
    <p>We may update this Privacy Policy from time to time. Any changes will be reflected on this page with an updated revision date.</p>

    <h3>Contact Us</h3>
    <p>If you have questions about this Privacy Policy, please visit our <a href="contact.html">Detailed Contact List</a> page.</p>
  `;

  const termsContent = `
    <h3>Terms of Use</h3>
    <p><strong>Last updated:</strong> February 2026</p>
    <p>Welcome to the Christian Believers Fellowship website. By accessing and using this website, you agree to the following terms.</p>

    <h3>Use of Content</h3>
    <p>The content on this website, including text, images, and media, is provided for informational and educational purposes related to the ministry of Christian Believers Fellowship. You may share our content for non-commercial purposes with proper attribution.</p>

    <h3>Blog &amp; Articles</h3>
    <p>Blog posts and articles published on this site represent the views of their respective authors. They are intended for spiritual edification and biblical teaching.</p>

    <h3>Accuracy of Information</h3>
    <p>We strive to keep the information on our website current and accurate, including service times, contact details, and event information. However, we recommend confirming details directly with the church for time-sensitive matters.</p>

    <h3>External Links</h3>
    <p>Our website may contain links to external sites. We are not responsible for the content or privacy practices of those sites.</p>

    <h3>Limitation of Liability</h3>
    <p>This website is provided "as is" without warranties of any kind. Christian Believers Fellowship shall not be liable for any damages arising from the use of this website.</p>

    <h3>Changes to These Terms</h3>
    <p>We reserve the right to update these Terms of Use at any time. Continued use of the site after changes constitutes acceptance of the updated terms.</p>

    <h3>Contact Us</h3>
    <p>If you have questions about these Terms of Use, please visit our <a href="contact.html">Detailed Contact List</a> page.</p>
  `;

  // Create modal element
  const overlay = document.createElement('div');
  overlay.className = 'legal-modal-overlay';
  overlay.innerHTML = `
    <div class="legal-modal">
      <div class="legal-modal-header">
        <h2 id="legal-modal-title"></h2>
        <button class="legal-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="legal-modal-body" id="legal-modal-body"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const titleEl = document.getElementById('legal-modal-title');
  const bodyEl = document.getElementById('legal-modal-body');
  const closeBtn = overlay.querySelector('.legal-modal-close');

  function openModal(title, content) {
    titleEl.textContent = title;
    bodyEl.innerHTML = content;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (privacyLink) {
    privacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('Privacy Policy', privacyContent);
    });
  }

  if (termsLink) {
    termsLink.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('Terms of Use', termsContent);
    });
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) closeModal();
  });
})();

// Add the mobile-only stacked wordmark to the header (CSS shows it only on
// small screens). Injected here so all pages get it without editing markup.
(function addMobileWordmark() {
  const link = document.querySelector('.header-logo-link');
  if (!link || link.querySelector('.header-wordmark-mobile')) return;
  const img = document.createElement('img');
  img.className = 'header-wordmark-mobile';
  img.src = 'images/wordmark-mobile.svg';
  img.alt = 'Christian Believers Fellowship — 32 Chapel Lane, Somersworth, New Hampshire';
  const wordmark = link.querySelector('.header-wordmark');
  if (wordmark) wordmark.insertAdjacentElement('afterend', img);
  else link.appendChild(img);
})();

// Mobile: turn the right-hand sidebar into a collapsible accordion so each
// section (Learn the Truth, Service Times, Location, Archives, Follow Us,
// Ministries) becomes a tidy, tappable row instead of a stack of cards.
// Only builds on small screens; the desktop sidebar is left untouched.
(function initSidebarAccordion() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const mq = window.matchMedia('(max-width: 768px)');
  let built = false;

  function build() {
    if (built) return;
    built = true;
    sidebar.classList.add('sidebar-accordion');

    sidebar.querySelectorAll('.sidebar-section').forEach((section, i) => {
      const h3 = section.querySelector('h3');
      if (!h3) return;

      // Move everything after the heading into a collapsible body.
      const body = document.createElement('div');
      body.className = 'sidebar-acc-body';
      body.id = 'sidebar-acc-' + i;
      const inner = document.createElement('div');
      inner.className = 'sidebar-acc-body-inner';
      let node = h3.nextSibling;
      while (node) {
        const next = node.nextSibling;
        inner.appendChild(node);
        node = next;
      }
      body.appendChild(inner);
      section.appendChild(body);

      // Turn the heading into the accordion trigger.
      h3.classList.add('sidebar-acc-trigger');
      h3.setAttribute('role', 'button');
      h3.setAttribute('tabindex', '0');
      h3.setAttribute('aria-expanded', 'false');
      h3.setAttribute('aria-controls', body.id);
      const chevron = document.createElement('i');
      chevron.className = 'fas fa-chevron-down sidebar-acc-icon';
      chevron.setAttribute('aria-hidden', 'true');
      h3.appendChild(chevron);

      function toggle() {
        const open = section.classList.toggle('open');
        h3.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      h3.addEventListener('click', toggle);
      h3.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  if (mq.matches) build();
  mq.addEventListener('change', (e) => { if (e.matches) build(); });
})();

// Mobile app bar: a native-app-style bottom tab bar + "More" sheet.
// Injected on every public page (CSS hides it on desktop). Primary tabs
// live in the bar; everything else lives in the slide-up sheet.
(function initMobileTabBar() {
  if (document.querySelector('.tab-bar')) return; // guard against double-init

  const page = currentPage || 'index.html';

  const tabs = [
    { href: 'index.html', icon: 'fa-house', label: 'Home' },
    { href: 'our-beliefs.html', icon: 'fa-book-bible', label: 'Beliefs' },
    { href: 'service-times.html', icon: 'fa-clock', label: 'Times' },
    { href: 'https://www.google.com/maps/search/?api=1&query=32+Chapel+Lane+Somersworth+NH', icon: 'fa-location-dot', label: 'Location', external: true }
  ];

  const moreLinks = [
    { href: 'photo-gallery.html', icon: 'fa-images', label: 'Photo Gallery' },
    { href: 'mission-statement.html', icon: 'fa-bullseye', label: 'Mission Statement' },
    { href: 'cbf-history.html', icon: 'fa-landmark', label: 'CBF History' },
    { href: 'learn-the-truth.html', icon: 'fa-book-open', label: 'Learn the Truth' },
    { href: 'article-archives.html', icon: 'fa-newspaper', label: 'Article Archives' },
    { href: 'video-archive.html', icon: 'fa-video', label: 'Video Archive' },
    { href: 'contact.html', icon: 'fa-address-book', label: 'Contact Us' },
    { href: 'donate.html', icon: 'fa-hand-holding-heart', label: 'Donate' },
    { href: 'admin/login.html', icon: 'fa-lock', label: 'Admin Login' }
  ];

  const activeIsMore = !tabs.some(t => t.href === page);

  // Build the tab bar
  const bar = document.createElement('nav');
  bar.className = 'tab-bar';
  bar.setAttribute('aria-label', 'Primary navigation');

  tabs.forEach(t => {
    const a = document.createElement('a');
    a.href = t.href;
    a.className = 'tab-item' + (t.href === page ? ' active' : '');
    if (t.href === page) a.setAttribute('aria-current', 'page');
    if (t.external) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    a.innerHTML = `<i class="fas ${t.icon}" aria-hidden="true"></i><span>${t.label}</span>`;
    bar.appendChild(a);
  });

  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'tab-item tab-more' + (activeIsMore ? ' active' : '');
  moreBtn.setAttribute('aria-haspopup', 'dialog');
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.innerHTML = `<i class="fas fa-ellipsis" aria-hidden="true"></i><span>More</span>`;
  bar.appendChild(moreBtn);

  document.body.appendChild(bar);

  // Build the "More" sheet
  const sheetOverlay = document.createElement('div');
  sheetOverlay.className = 'tab-sheet-overlay';
  const linksHtml = moreLinks.map(l =>
    `<a href="${l.href}" class="${l.href === page ? 'active' : ''}">` +
    `<i class="fas ${l.icon}" aria-hidden="true"></i>${l.label}</a>`
  ).join('');
  sheetOverlay.innerHTML = `
    <div class="tab-sheet" role="dialog" aria-label="More menu" aria-modal="true">
      <div class="tab-sheet-handle"></div>
      ${linksHtml}
      <button type="button" class="tab-sheet-btn tab-sheet-theme"></button>
    </div>
  `;
  document.body.appendChild(sheetOverlay);

  const themeBtn = sheetOverlay.querySelector('.tab-sheet-theme');

  function isDark() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function syncThemeLabel() {
    const dark = isDark();
    themeBtn.innerHTML =
      `<i class="fas ${dark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i>` +
      `${dark ? 'Light mode' : 'Dark mode'}`;
  }
  syncThemeLabel();

  function openSheet() {
    sheetOverlay.classList.add('active');
    moreBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    sheetOverlay.classList.remove('active');
    moreBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  moreBtn.addEventListener('click', () => {
    sheetOverlay.classList.contains('active') ? closeSheet() : openSheet();
  });

  sheetOverlay.addEventListener('click', (e) => {
    if (e.target === sheetOverlay) closeSheet();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOverlay.classList.contains('active')) closeSheet();
  });

  themeBtn.addEventListener('click', () => {
    const desktopToggle = document.querySelector('.theme-toggle');
    if (desktopToggle) {
      desktopToggle.click(); // reuse existing theme logic (localStorage + icon sync)
    } else {
      const next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('cbf-theme', next);
    }
    syncThemeLabel();
  });
})();

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .catch(() => {});
  });
}
