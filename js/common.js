// API Configuration
// Change this to your Render.com URL in production
const API_BASE = 'https://cbfchurch-api.99redder.workers.dev';

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
// The database (Neon free tier) suspends when idle, so the first request
// after a quiet spell can fail (network error / 5xx) while it wakes up.
// Retry those a few times before giving up; 4xx responses fail immediately.
async function apiFetch(endpoint) {
  const retryDelays = [2000, 5000, 10000];
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include' });
    } catch (err) {
      if (attempt >= retryDelays.length) throw err;
    }
    if (res) {
      if (res.ok) return res.json();
      if (res.status < 500 || attempt >= retryDelays.length) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }
    }
    await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
  }
}

// Recent-service video: the embed plays the channel's uploads newest-first.
// If the newest upload can't be played (e.g. blocked by a copyright claim),
// YouTube shows "Video unavailable" — step to the next upload instead.
(function initLatestVideo() {
  const frame = document.getElementById('latest-video');
  if (!frame) return;

  const UPLOADS_PLAYLIST = 'UUJQMXhX_PLUuaf2VIwIMqWw';
  const MAX_SKIPS = 5;
  let index = 0;
  let lastSkip = 0;

  // When the first video is unplayable the player never loads the playlist,
  // so re-cue it by id at the next position rather than calling nextVideo().
  function skip(player) {
    // onReady and onError both report the same blocked video; skip it once.
    const now = Date.now();
    if (index >= MAX_SKIPS || now - lastSkip < 1500) return;
    lastSkip = now;
    index++;
    player.cuePlaylist({ list: UPLOADS_PLAYLIST, listType: 'playlist', index: index });
  }

  function build() {
    new YT.Player(frame, {
      events: {
        // A video blocked at load reports through getVideoData(), not onError.
        onReady: function (e) {
          const data = e.target.getVideoData ? e.target.getVideoData() : null;
          if (data && data.errorCode) skip(e.target);
        },
        onError: function (e) { skip(e.target); }
      }
    });
  }

  if (window.YT && window.YT.Player) return build();
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (prev) prev();
    build();
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
})();

// Shared legal copy — used by the desktop modals (below) and the mobile
// footer dropdowns in the sidebar accordion (initSidebarAccordion).
let cbfLegalContent = { privacy: '', terms: '' };

// Legal modals (Privacy Policy & Terms of Use)
(function initLegalModals() {
  const privacyContent = `
    <h3>Privacy Policy</h3>
    <p><strong>Last updated:</strong> October 2026</p>
    <p>Christian Believers Fellowship ("CBF," "we," "us," or "our") operates the website www.cbfchurch.com. This Privacy Policy explains what information the site handles, why, and who else is involved in providing it.</p>

    <h3>Information We Collect</h3>
    <p>You can read the site without giving us any personal information. We do not use analytics, advertising networks, or tracking cookies, and we do not sell, rent, or trade anyone's information.</p>
    <p>We only receive personal information when you choose to send it:</p>
    <ul>
      <li><strong>Quick message form:</strong> when you send a message from our Contact page, we collect your name, email address, optional phone number, subject, message, and the church contact(s) you choose. The message is emailed directly to those contacts so they can reply to you. We do not store messages in a database or add you to any mailing list.</li>
      <li><strong>Donations:</strong> if you give online, you may enter your name and email address, and you choose an amount and frequency. Payment card details are entered on Stripe's secure checkout page and are never seen or stored by CBF.</li>
      <li><strong>Contacting us directly:</strong> if you email or call someone listed on our Contact page, what you share is used only to respond to you.</li>
    </ul>

    <h3>Spam Protection &amp; Security</h3>
    <p>To keep the quick message form free of spam, it uses Cloudflare Turnstile, which checks that a real person is submitting the form. Turnstile may process technical information such as your IP address and browser characteristics. Our server also briefly uses IP addresses in memory to limit repeated requests, and our hosting providers may keep standard technical logs for security and reliability.</p>

    <h3>Cookies &amp; Local Storage</h3>
    <p>For visitors, the site uses your browser's local storage only to remember your light/dark theme preference. This stays on your device and is never sent to us.</p>
    <p>The site can also be installed as an app on your phone or computer. It uses a service worker for this, which does not collect or transmit personal information.</p>
    <p>Church staff who sign in to the site's administration area receive a login token stored in their browser (and a login cookie) to keep them signed in. This does not apply to regular visitors.</p>

    <h3>Third-Party Services</h3>
    <p>We rely on a few trusted services to run the site. Each handles information under its own privacy policy:</p>
    <ul>
      <li><strong>Stripe</strong> processes online donations, including payment details, receipts, and recurring gifts.</li>
      <li><strong>Resend</strong> delivers quick-message emails to our church contacts.</li>
      <li><strong>Cloudflare</strong> hosts our website services and photo gallery, and provides the Turnstile spam check.</li>
      <li><strong>Neon</strong> hosts the database that stores our blog posts, photo gallery details, and staff accounts. It does not store visitor information.</li>
      <li><strong>YouTube</strong> provides embedded service videos. YouTube may set cookies or collect information when a page with a video is viewed.</li>
      <li><strong>Google Maps</strong> provides the embedded map on our Service Times page. Google may collect information when the map loads.</li>
      <li><strong>cdnjs (Cloudflare)</strong> delivers the icon set used across the site and may log standard request information.</li>
    </ul>
    <p>We encourage you to review these services' privacy practices.</p>

    <h3>Children's Privacy</h3>
    <p>Our website is not directed at children under 13, and we do not knowingly collect personal information from children. If you believe a child has sent us personal information, please contact us and we will delete it.</p>

    <h3>Your Choices</h3>
    <p>You are never required to send us personal information. To ask about information you've shared with us, or to change or cancel a recurring donation, please contact us using the details below.</p>

    <h3>Changes to This Policy</h3>
    <p>We may update this Privacy Policy from time to time. Any changes will be reflected on this page with an updated revision date.</p>

    <h3>Contact Us</h3>
    <p>If you have questions about this Privacy Policy, please visit our <a href="contact.html">Detailed Contact List</a> page.</p>
  `;

  const termsContent = `
    <h3>Terms of Use</h3>
    <p><strong>Last updated:</strong> October 2026</p>
    <p>Welcome to the Christian Believers Fellowship website. By accessing and using this website, you agree to the following terms.</p>

    <h3>Use of Content</h3>
    <p>The content on this website, including text, images, and media, is provided for informational and educational purposes related to the ministry of Christian Believers Fellowship. You may share our content for non-commercial purposes with proper attribution.</p>

    <h3>Blog &amp; Articles</h3>
    <p>Blog posts and articles published on this site represent the views of their respective authors. They are intended for spiritual edification and biblical teaching.</p>

    <h3>Online Donations</h3>
    <p>Donations made through this site are voluntary gifts to support the ministry of Christian Believers Fellowship. Payments are processed securely by Stripe and are subject to Stripe's terms. If you set up a monthly or yearly donation, it continues until you ask us to change or cancel it. If you believe a donation was made in error, please contact us promptly.</p>

    <h3>Quick Message Form</h3>
    <p>The quick message form on our Contact page is for genuine questions and communication with church contacts. Please do not use it to send spam, advertising, or abusive, threatening, or unlawful content. We may block messages that misuse the form or that fail our spam check.</p>

    <h3>Administration Area</h3>
    <p>The administration area of this site is for authorized church staff only. Attempting to access it without permission, or otherwise interfering with the site's operation or security, is prohibited.</p>

    <h3>Accuracy of Information</h3>
    <p>We strive to keep the information on our website current and accurate, including service times, contact details, and event information. However, we recommend confirming details directly with the church for time-sensitive matters.</p>

    <h3>External Links &amp; Embedded Content</h3>
    <p>Our website contains links to external sites and embedded content from services such as YouTube and Google Maps. Your use of that content is subject to those providers' terms. We are not responsible for the content or privacy practices of external sites.</p>

    <h3>Limitation of Liability</h3>
    <p>This website is provided "as is" without warranties of any kind. Christian Believers Fellowship shall not be liable for any damages arising from the use of this website.</p>

    <h3>Changes to These Terms</h3>
    <p>We reserve the right to update these Terms of Use at any time. Continued use of the site after changes constitutes acceptance of the updated terms.</p>

    <h3>Contact Us</h3>
    <p>If you have questions about these Terms of Use, please visit our <a href="contact.html">Detailed Contact List</a> page.</p>
  `;

  // Share the copy so the mobile footer dropdowns can reuse it.
  cbfLegalContent.privacy = privacyContent;
  cbfLegalContent.terms = termsContent;

  const privacyLink = document.getElementById('privacy-link');
  const termsLink = document.getElementById('terms-link');
  if (!privacyLink && !termsLink) return;

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

    // Append the footer's Contact / Privacy / Terms as extra dropdowns after
    // Ministries (mobile only). Privacy & Terms reveal their full text inline
    // (reusing the legal copy); Contact links out to the full contact page.
    const stripHeading = (html) => html.replace(/^\s*<h3>[\s\S]*?<\/h3>/, '');
    const extras = [
      {
        title: 'Contact Us',
        html: '<p style="font-size:0.9rem;margin-bottom:0.5rem;">Reach any of our leadership team members, or send a quick message.</p>' +
              '<a href="contact.html" style="font-size:0.9rem;">Go to Contact page &rarr;</a>'
      },
      { title: 'Privacy Policy', html: stripHeading(cbfLegalContent.privacy), doc: true },
      { title: 'Terms of Use', html: stripHeading(cbfLegalContent.terms), doc: true }
    ];
    extras.forEach((x) => {
      const sec = document.createElement('div');
      // sidebar-acc-extra marks the injected footer dropdowns so the desktop
      // safety net can hide them if the accordion was built then the window
      // is widened back to desktop.
      sec.className = 'sidebar-section sidebar-acc-extra' + (x.doc ? ' sidebar-acc-doc' : '');
      sec.innerHTML = '<h3>' + x.title + '</h3>' + x.html;
      sidebar.appendChild(sec);
    });

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
    { href: 'service-times.html#location', icon: 'fa-location-dot', label: 'Location' }
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
