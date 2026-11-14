// Build redirect pages for the site's old Blogger addresses.
//
// Before the 2026 redesign, www.cbfchurch.com pointed at Blogger, so Google and
// old links know addresses like /p/service-times.html and
// /2020/11/weekly-blog-solid-rock.html. GitHub Pages can't send real 301s, so
// each old address gets a tiny HTML page with an instant meta refresh (which
// Google treats as a permanent redirect) plus a canonical tag to the new page.
//
// The old → new list lives in scripts/blogger-redirects.json. Edit it, then run
// from the repo root:   node scripts/build-blogger-redirects.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://www.cbfchurch.com/';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const redirects = JSON.parse(readFileSync(join(root, 'scripts/blogger-redirects.json'), 'utf8'));
const MARKER = '<!-- blogger-redirect -->';

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let written = 0;
for (const [oldPath, { title, to }] of Object.entries(redirects)) {
  if (!/^\/(p|\d{4}\/\d{2})\/[a-z0-9-]+\.html$/.test(oldPath)) {
    throw new Error(`Unexpected old path: ${oldPath}`);
  }
  const file = join(root, oldPath);
  // Never overwrite a real page, only earlier output of this script.
  if (existsSync(file) && !readFileSync(file, 'utf8').includes(MARKER)) {
    throw new Error(`Refusing to overwrite non-redirect file: ${oldPath}`);
  }
  const url = SITE + to;
  const html = `<!DOCTYPE html>
${MARKER}
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)} | Christian Believers Fellowship</title>
  <link rel="canonical" href="${esc(url)}">
  <meta http-equiv="refresh" content="0; url=${esc(url)}">
  <script>location.replace(${JSON.stringify(url)});</script>
</head>
<body>
  <p>This page has moved to <a href="${esc(url)}">${esc(url)}</a>.</p>
</body>
</html>
`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  written++;
}
console.log(`Wrote ${written} redirect pages.`);
