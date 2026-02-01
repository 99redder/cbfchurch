const express = require('express');
const router = express.Router();
const { get, all } = require('../utils/db');

// GET /api/posts - paginated blog posts (public)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 5));
    const offset = (page - 1) * limit;

    const posts = await all(
      'SELECT id, title, content, author, slug, created_at, updated_at FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const countRow = await get('SELECT COUNT(*) as count FROM posts');
    const count = countRow ? parseInt(countRow.count) : 0;
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
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/posts/archives - posts grouped by year/month
router.get('/archives', async (req, res) => {
  try {
    const archives = await all(`
      SELECT
        EXTRACT(YEAR FROM created_at)::text as year,
        LPAD(EXTRACT(MONTH FROM created_at)::text, 2, '0') as month,
        COUNT(*)::int as count
      FROM posts
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `);

    res.json(archives);
  } catch (err) {
    console.error('Get archives error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/posts/:slug - single post by slug
router.get('/:slug', async (req, res) => {
  try {
    const post = await get(
      'SELECT id, title, content, author, slug, created_at, updated_at FROM posts WHERE slug = $1',
      [req.params.slug]
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = router;
