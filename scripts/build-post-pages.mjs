// Build a static HTML page for every blog post: posts/<slug>.html.
//
// Why: Google's renderer does not get an answer from the API when it loads a
// page (Search Console live test, Nov 2026: the /api/posts/<slug> call fails
// and the page stays on "Loading post"). With post.html?slug=... every post
// therefore looked like the same empty page and Google indexed only one of
// them ("Duplicate without user-selected canonical"). These pages have the
// post text, canonical tag and structured data written into the HTML, so
// nothing depends on the API.
//
// post.html is the template, so header / nav / sidebar changes made there
// carry over the next time this runs. The daily GitHub Action
// (.github/workflows/sync-posts-sitemap.yml) runs it; to run it by hand, from
// the repo root:   node scripts/build-post-pages.mjs
//
// It only writes, overwrites or deletes its own output (files that contain
// the MARKER below). It exits with an error, changing nothing, if the API
// does not return the full list of posts.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://www.cbfchurch.com/';
const API = process.env.CBF_API_BASE || 'https://cbfchurch-api.99redder.workers.dev';
const MARKER = '<!-- generated-post-page -->';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'posts');

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function getJson(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      throw new Error(`${res.status} from ${url}`);
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise(r => setTimeout(r, 5000 * (attempt + 1))); // database may be waking up
    }
  }
}

async function fetchAllPosts() {
  const posts = [];
  let totalPosts = 0;
  for (let page = 1; ; page++) {
    const data = await getJson(`${API}/api/posts?page=${page}&limit=20`);
    posts.push(...data.posts);
    totalPosts = data.totalPosts;
    if (page >= data.totalPages) break;
  }
  if (posts.length < 1 || posts.length !== totalPosts) {
    throw new Error(`Expected ${totalPosts} posts but received ${posts.length}; not changing anything.`);
  }
  return posts;
}

// Plain text of a post, for the description.
function toText(html) {
  return html.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// Trim text to roughly `max` characters at a word boundary (same as js/post.js).
function summarize(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-—]+$/, '') + '…';
}

const formatDate = iso => new Date(iso).toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York'
});

// Replace exactly one match, or stop: a miss means post.html changed shape
// and this script needs updating, which is better than publishing broken pages.
function swap(html, pattern, replacement, what) {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g')) || [];
  if (matches.length !== 1) throw new Error(`post.html template: expected one "${what}", found ${matches.length}`);
  return html.replace(pattern, () => replacement);
}

function buildPage(template, post) {
  const path = `posts/${post.slug}.html`;
  const url = SITE + path;
  const title = `${post.title} | Christian Believers Fellowship`;
  const description = summarize(toText(post.content), 155)
    || `${post.title} — Christian Believers Fellowship, Somersworth, NH.`;
  const firstImage = (post.content.match(/<img[^>]+src="(https?:[^"]+)"/) || [])[1];

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
    publisher: { '@type': 'Church', name: 'Christian Believers Fellowship', url: SITE }
  };
  if (firstImage) data.image = firstImage;
  const jsonLd = JSON.stringify(data).replace(/</g, '\\u003c');

  // The page lives in /posts/ but all of the site's links are written relative
  // to the root, so <base href="/"> keeps every link, image and script working
  // (including the ones js/common.js adds). Links to "#something" inside the
  // post would then point at the home page, so give them the full path.
  const content = post.content.replace(/(href=["'])#(?=[^"'])/g, `$1${path}#`);

  const article = `<div id="post-content">
        <article class="post-full card">
          <h1>${esc(post.title)}</h1>
          <div class="post-meta mb-2">
            <span><time datetime="${esc(new Date(post.created_at).toISOString())}">${esc(formatDate(post.created_at))}</time></span>
            <span>${esc(post.author)}</span>
          </div>
          <div class="post-content">${content}</div>
          <a href="index.html" class="back-link">&larr; Back to Home</a>
        </article>
      </div>`;

  let html = template;
  html = swap(html, /<!DOCTYPE html>/, `<!DOCTYPE html>\n${MARKER}`, 'doctype');
  html = swap(html, /<meta charset="UTF-8">/, '<meta charset="UTF-8">\n  <base href="/">', 'charset meta');
  html = swap(html, /\s*<!-- post-redirect:start -->[\s\S]*?<!-- post-redirect:end -->/, '', 'post-redirect block');
  html = swap(html, /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${esc(description)}">`, 'description meta');
  html = swap(html, /<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`, 'title');
  html = swap(html, /<!-- No static canonical[\s\S]*?-->/,
    `<link rel="canonical" href="${esc(url)}">\n  <meta property="og:url" content="${esc(url)}">`, 'canonical comment');
  html = swap(html, /<meta property="og:type" content="website">/,
    '<meta property="og:type" content="article">', 'og:type');
  html = swap(html, /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${esc(post.title)}">`, 'og:title');
  html = swap(html, /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${esc(description)}">`, 'og:description');
  html = swap(html, /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${esc(post.title)}">`, 'twitter:title');
  html = swap(html, /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${esc(description)}">`, 'twitter:description');
  html = swap(html, /<\/head>/,
    `  <script type="application/ld+json">${jsonLd}</script>\n</head>`, '</head>');
  html = swap(html, /<a href="#main"/, `<a href="${path}#main"`, 'skip link');
  html = swap(html, /<div id="post-content">[\s\S]*?<\/div>\s*<\/div>/, article, 'post-content block');
  html = swap(html, /\s*<script src="js\/post\.js[^"]*"><\/script>/, '', 'post.js script');
  return html;
}

const template = readFileSync(join(root, 'post.html'), 'utf8');
const posts = await fetchAllPosts();

mkdirSync(outDir, { recursive: true });
const wanted = new Set();
let written = 0, unchanged = 0, skipped = 0;

for (const post of posts) {
  // The slug becomes a file name. Anything unusual is skipped; that post is
  // still readable through post.html?slug=...&live=1 (see 404.html).
  if (!/^[a-z0-9-]+$/.test(post.slug)) {
    console.warn(`Skipping post with an unusual slug: ${JSON.stringify(post.slug)}`);
    skipped++;
    continue;
  }
  const name = `${post.slug}.html`;
  const file = join(outDir, name);
  wanted.add(name);
  const html = buildPage(template, post);
  if (existsSync(file)) {
    const current = readFileSync(file, 'utf8');
    if (!current.includes(MARKER)) throw new Error(`Refusing to overwrite a file this script did not make: posts/${name}`);
    if (current === html) { unchanged++; continue; }
  }
  writeFileSync(file, html);
  written++;
}

// Remove pages for posts that were deleted.
let removed = 0;
for (const name of readdirSync(outDir)) {
  if (!name.endsWith('.html') || wanted.has(name)) continue;
  const file = join(outDir, name);
  if (!readFileSync(file, 'utf8').includes(MARKER)) continue;
  unlinkSync(file);
  removed++;
}

console.log(`Post pages: ${written} written, ${unchanged} unchanged, ${removed} removed, ${skipped} skipped (${posts.length} posts).`);
