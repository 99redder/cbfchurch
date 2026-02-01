#!/usr/bin/env node
// Download gallery photos from the existing CBF Blogger site
//
// Usage: node scripts/download-gallery.js
//
// This script fetches the photo gallery page from the current site
// and downloads all images to images/gallery/

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const GALLERY_URL = 'https://cbfchurch.blogspot.com/p/photo-gallery.html';
const OUTPUT_DIR = path.join(__dirname, '..', 'images', 'gallery');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ body: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadImage(url, filename) {
  try {
    const { body } = await fetch(url);
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, body);
    console.log(`  Downloaded: ${filename}`);
    return true;
  } catch (err) {
    console.error(`  Failed: ${filename} - ${err.message}`);
    return false;
  }
}

async function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Fetching gallery page...');
  const { body } = await fetch(GALLERY_URL);
  const html = body.toString('utf8');

  // Extract image URLs from the page
  const imgRegex = /src=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)/gi;
  const urls = new Set();
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    let url = match[1];
    // Get highest resolution version (remove Blogger size params)
    url = url.replace(/\/s\d+\//, '/s1600/');
    url = url.replace(/=s\d+/, '=s1600');
    urls.add(url);
  }

  // Also look for links that point to images
  const linkRegex = /href=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    let url = match[1];
    url = url.replace(/\/s\d+\//, '/s1600/');
    url = url.replace(/=s\d+/, '=s1600');
    urls.add(url);
  }

  console.log(`Found ${urls.size} image URLs.`);

  let downloaded = 0;
  let index = 1;

  for (const url of urls) {
    // Generate filename from URL or use index
    let filename;
    try {
      const parsed = new URL(url);
      const basename = path.basename(parsed.pathname);
      filename = basename.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        ? basename
        : `photo-${index}.jpg`;
    } catch {
      filename = `photo-${index}.jpg`;
    }

    // Avoid duplicates
    if (fs.existsSync(path.join(OUTPUT_DIR, filename))) {
      filename = `photo-${index}-${Date.now()}.jpg`;
    }

    if (await downloadImage(url, filename)) {
      downloaded++;
    }
    index++;
  }

  console.log(`\nDone! Downloaded ${downloaded} of ${urls.size} images to ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
