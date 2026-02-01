const express = require('express');
const router = express.Router();
const { get, all } = require('../utils/db');

// GET /api/posts - paginated blog posts (public)
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 5));
  const offset = (page - 1) * limit;

  const posts = all(
    'SELECT id, title, content, author, slug, created_at, updated_at FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );

  const countRow = get('SELECT COUNT(*) as count FROM posts');
  const count = countRow ? countRow.count : 0;
  const totalPages = Math.ceil(count / limit);

  res.json({
    posts: posts.map(p => ({
      ...p,
      preview: stripHtml(p.content).substring(0, 250)
    })),
    page,
    totalPages,
    totalPosts: count
  });
});

// GET /api/posts/archives - posts grouped by year/month
router.get('/archives', (req, res) => {
  const archives = all(`
    SELECT
      strftime('%Y', created_at) as year,
      strftime('%m', created_at) as month,
      COUNT(*) as count
    FROM posts
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `);

  res.json(archives);
});

// GET /api/posts/:slug - single post by slug
router.get('/:slug', (req, res) => {
  const post = get(
    'SELECT id, title, content, author, slug, created_at, updated_at FROM posts WHERE slug = ?',
    [req.params.slug]
  );

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  res.json(post);
});

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = router;
