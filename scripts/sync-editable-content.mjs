// Copy admin-edited page text from the API into the HTML files.
//
// cbf-history.html and our-beliefs.html can be edited in place by admins
// (js/editable-content.js saves to the site_content table, and the page loads
// the saved text on every visit). The HTML files also carry that text as a
// default so search engines see it without running JavaScript. This script
// refreshes those defaults from the saved versions. It runs weekly from
// .github/workflows/sync-editable-content.yml, or by hand from the repo root:
//   node scripts/sync-editable-content.mjs
// It only rewrites the inside of elements marked data-content-field, using the
// same markup editable-content.js produces (DIV fields: one <p> per paragraph).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://cbfchurch-api.99redder.workers.dev';
const PAGES = [
  { file: 'cbf-history.html', key: 'history' },
  { file: 'our-beliefs.html', key: 'beliefs' }
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const escapeText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FIELD_RE = /(<(\w+)\b[^>]*data-content-field="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g;

async function fetchFields(key) {
  const res = await fetch(`${API_BASE}/api/content/${encodeURIComponent(key)}`, {
    headers: { 'User-Agent': 'cbfchurch-content-sync (GitHub Actions)' }
  });
  if (!res.ok) throw new Error(`GET /api/content/${key} returned ${res.status}`);
  const data = await res.json();
  const fields = data?.value?.fields;
  if (!fields || typeof fields !== 'object') throw new Error(`No saved fields for "${key}"`);
  return fields;
}

let changedFiles = 0;
for (const { file, key } of PAGES) {
  const fields = await fetchFields(key);
  const path = join(root, file);
  const src = readFileSync(path, 'utf8');
  const updated = [];

  const out = src.replace(FIELD_RE, (match, openTag, tag, name, inner, closeTag, offset) => {
    if (!Object.prototype.hasOwnProperty.call(fields, name)) return match;
    const text = String(fields[name] ?? '');
    let replacement;
    if (tag.toLowerCase() === 'div') {
      const indent = src.slice(0, offset).match(/[ \t]*$/)[0];
      const paras = text.split('\n\n').map(p => p.trim()).filter(Boolean);
      replacement = `${openTag}${paras.map(p => `\n${indent}  <p>${escapeText(p)}</p>`).join('')}\n${indent}${closeTag}`;
    } else {
      replacement = `${openTag}${escapeText(text)}${closeTag}`;
    }
    if (replacement !== match) updated.push(name);
    return replacement;
  });

  if (out !== src) {
    writeFileSync(path, out);
    changedFiles++;
    console.log(`${file}: updated ${updated.join(', ')}`);
  } else {
    console.log(`${file}: already up to date`);
  }
}
console.log(changedFiles ? `Updated ${changedFiles} file(s).` : 'No edits to sync.');
