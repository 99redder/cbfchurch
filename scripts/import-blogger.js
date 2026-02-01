#!/usr/bin/env node
// Import blog posts from a Blogger XML export file
//
// Usage:
//   1. Export your Blogger blog: Settings > Other > Back up content
//   2. Run: node scripts/import-blogger.js <path-to-blogger-export.xml>
//
// Requires DATABASE_URL env var to be set (or .env in api/ directory)

const fs = require('fs');
const path = require('path');

function parseBloggerExport(xmlContent) {
  const posts = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;

  let match;
  while ((match = entryRegex.exec(xmlContent)) !== null) {
    const entry = match[1];

    // Google Takeout format: <blogger:type>POST</blogger:type>
    // Standard Blogger export: <category term="...kind#post"/>
    const isGoogleTakeout = entry.includes('<blogger:type>');
    let isPost, isDraft;

    if (isGoogleTakeout) {
      isPost = entry.includes('<blogger:type>POST</blogger:type>');
      isDraft = entry.includes('<blogger:status>DRAFT</blogger:status>');
    } else {
      const categoryMatches = entry.match(/<category[^>]*term="([^"]*)"[^>]*\/>/g) || [];
      const terms = categoryMatches.map(c => {
        const m = c.match(/term="([^"]*)"/);
        return m ? m[1] : '';
      });
      isPost = terms.some(t => t.includes('kind#post'));
      const draftMatch = entry.match(/<app:draft[^>]*>(yes|no)<\/app:draft>/);
      isDraft = draftMatch && draftMatch[1] === 'yes';
    }

    if (!isPost || isDraft) continue;

    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const title = titleMatch ? decodeXml(titleMatch[1].trim()) : 'Untitled';

    const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);
    const content = contentMatch ? decodeXml(contentMatch[1].trim()) : '';

    const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
    const published = publishedMatch ? publishedMatch[1].trim() : new Date().toISOString();

    const authorMatch = entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/);
    const author = authorMatch ? decodeXml(authorMatch[1].trim()) : 'CBF';

    if (title && content) {
      posts.push({ title, content, author, published });
    }
  }

  return posts;
}

function decodeXml(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

async function main() {
  const xmlPath = process.argv[2];
  if (!xmlPath) {
    console.error('Usage: node scripts/import-blogger.js <blogger-export.xml>');
    process.exit(1);
  }

  if (!fs.existsSync(xmlPath)) {
    console.error(`File not found: ${xmlPath}`);
    process.exit(1);
  }

  // Load env and modules from api/ directory
  const apiDir = path.join(__dirname, '..', 'api');
  require(path.join(apiDir, 'node_modules', 'dotenv')).config({ path: path.join(apiDir, '.env') });
  const dbModule = require(path.join(apiDir, 'utils', 'db'));
  const init = require(path.join(apiDir, 'database', 'init'));

  await init();

  const xmlContent = fs.readFileSync(xmlPath, 'utf8');
  const posts = parseBloggerExport(xmlContent);

  console.log(`Found ${posts.length} blog posts in the export file.`);

  let imported = 0;
  let skipped = 0;
  const slugs = new Set();

  for (const post of posts) {
    let slug = generateSlug(post.title);

    if (slugs.has(slug)) {
      let counter = 2;
      while (slugs.has(`${slug}-${counter}`)) counter++;
      slug = `${slug}-${counter}`;
    }
    slugs.add(slug);

    const existing = await dbModule.get('SELECT id FROM posts WHERE slug = $1', [slug]);
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await dbModule.run(
        'INSERT INTO posts (title, content, author, slug, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [post.title, post.content, post.author, slug, post.published, post.published]
      );
      imported++;
      console.log(`  Imported: ${post.title}`);
    } catch (err) {
      console.error(`  Failed: ${post.title} - ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone! Imported: ${imported}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
