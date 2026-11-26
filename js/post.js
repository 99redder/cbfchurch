// Single blog post loader
//
// Posts normally live on their own static pages, posts/<slug>.html (built by
// scripts/build-post-pages.mjs), and post.html?slug=... forwards there. This
// loader only runs as the fallback for a post that has no static page yet
// (post.html?slug=...&live=1, reached through 404.html). It adds the per-post
// SEO tags once the post loads, with the canonical pointing at the static
// address the post will have after the next daily build.
const POST_SITE_URL = 'https://www.cbfchurch.com/';

(async function () {
  const container = document.getElementById('post-content');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    showNotFound(container, true);
    return;
  }

  try {
    const post = await apiFetch(`/api/posts/${encodeURIComponent(slug)}`);

    document.title = `${post.title} | Christian Believers Fellowship`;

    container.innerHTML = `
      <article class="post-full card">
        <h1>${escapeHtml(post.title)}</h1>
        <div class="post-meta mb-2">
          <span>${formatDate(post.created_at)}</span>
          <span>${escapeHtml(post.author)}</span>
        </div>
        <div class="post-content">${post.content}</div>
        <a href="index.html" class="back-link">&larr; Back to Home</a>
      </article>`;

    try {
      applyPostSeo(post);
    } catch (seoErr) {
      console.warn('Could not set post SEO tags', seoErr); // never block the post itself
    }
  } catch (err) {
    // Only a real 404 is marked noindex; a temporary API/network failure must
    // not tell Google to drop a post that exists.
    showNotFound(container, err.status === 404);
  }
})();

function showNotFound(container, definitelyMissing) {
  container.innerHTML = `
    <div class="empty-state">
      <p>Post not found.</p>
      <a href="index.html" class="back-link">&larr; Back to Home</a>
    </div>`;
  if (definitelyMissing) setHeadTag('meta[name="robots"]', 'meta', { name: 'robots', content: 'noindex' });
}

function applyPostSeo(post) {
  const url = `${POST_SITE_URL}posts/${encodeURIComponent(post.slug)}.html`;
  // Parse into an inert document so reading the text doesn't load images or run handlers.
  const doc = new DOMParser().parseFromString(post.content || '', 'text/html');
  const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  const description = summarize(text, 155) || `${post.title} — Christian Believers Fellowship, Somersworth, NH.`;
  const firstImage = doc.querySelector('img[src^="http"]')?.getAttribute('src');

  setHeadTag('link[rel="canonical"]', 'link', { rel: 'canonical', href: url });
  setHeadTag('meta[name="description"]', 'meta', { name: 'description', content: description });

  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description,
    url,
    mainEntityOfPage: url,
    datePublished: new Date(post.created_at).toISOString(),
    dateModified: new Date(post.updated_at || post.created_at).toISOString(),
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Church', name: 'Christian Believers Fellowship', url: POST_SITE_URL }
  };
  if (firstImage) data.image = firstImage;

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

// Trim text to roughly `max` characters at a word boundary.
function summarize(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-—]+$/, '') + '…';
}

// Update an existing <head> tag, or create it if missing.
function setHeadTag(selector, tagName, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(tagName);
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
