const express = require('express');
const router = express.Router();
const { get, all, run } = require('../utils/db');
const { requireAuth } = require('../utils/auth');

// All admin routes require authentication
router.use(requireAuth);

// GET /api/admin/posts - all posts for dashboard
router.get('/posts', (req, res) => {
  const posts = all(
    'SELECT id, title, author, slug, created_at, updated_at FROM posts ORDER BY created_at DESC'
  );
  res.json(posts);
});

// POST /api/admin/posts - create new post
router.post('/posts', (req, res) => {
  const { title, content, author } = req.body;
  if (!title || !content || !author) {
    return res.status(400).json({ error: 'Title, content, and author are required' });
  }

  const slug = generateSlug(title);

  const existing = get('SELECT id FROM posts WHERE slug = ?', [slug]);
  if (existing) {
    return res.status(409).json({ error: 'A post with a similar title already exists' });
  }

  const result = run(
    'INSERT INTO posts (title, content, author, slug) VALUES (?, ?, ?, ?)',
    [title, content, author, slug]
  );

  res.status(201).json({
    message: 'Post created',
    id: result.lastInsertRowid,
    slug
  });
});

// PUT /api/admin/posts/:id - update post
router.put('/posts/:id', (req, res) => {
  const { title, content, author } = req.body;
  if (!title || !content || !author) {
    return res.status(400).json({ error: 'Title, content, and author are required' });
  }

  const post = get('SELECT id FROM posts WHERE id = ?', [parseInt(req.params.id)]);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const slug = generateSlug(title);

  const conflict = get('SELECT id FROM posts WHERE slug = ? AND id != ?', [slug, parseInt(req.params.id)]);
  if (conflict) {
    return res.status(409).json({ error: 'A post with a similar title already exists' });
  }

  run(
    'UPDATE posts SET title = ?, content = ?, author = ?, slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, content, author, slug, parseInt(req.params.id)]
  );

  res.json({ message: 'Post updated', slug });
});

// DELETE /api/admin/posts/:id - delete post
router.delete('/posts/:id', (req, res) => {
  const post = get('SELECT id FROM posts WHERE id = ?', [parseInt(req.params.id)]);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  run('DELETE FROM posts WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ message: 'Post deleted' });
});

// GET /api/admin/posts/:id - single post for editing
router.get('/posts/:id', (req, res) => {
  const post = get('SELECT * FROM posts WHERE id = ?', [parseInt(req.params.id)]);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(post);
});

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

module.exports = router;
