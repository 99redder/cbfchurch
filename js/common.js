// API Configuration
// Change this to your Render.com URL in production
const API_BASE = 'https://cbfchurch.onrender.com';

// Set footer year
const yearEl = document.getElementById('footer-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const themeToggle = document.querySelector('.theme-toggle');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close nav when clicking a link (mobile)
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
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
    <p>If you have questions about this Privacy Policy, please contact us through the information on our Contact page.</p>
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
    <p>If you have questions about these Terms of Use, please contact us through the information on our Contact page.</p>
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

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .catch(() => {});
  });
}
