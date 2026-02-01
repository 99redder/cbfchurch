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

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .catch(() => {});
  });
}
