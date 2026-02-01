const express = require('express');
const router = express.Router();
const { get, all, run } = require('../utils/db');
const { requireAuth } = require('../utils/auth');

// All admin routes require authentication
router.use(requireAuth);

// GET /api/admin/posts - all posts for dashboard
router.get('/posts', async (req, res) => {
  try {
    const posts = await all(
      'SELECT id, title, author, slug, created_at, updated_at FROM posts ORDER BY created_at DESC'
    );
    res.json(posts);
  } catch (err) {
    console.error('Admin get posts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/posts - create new post
router.post('/posts', async (req, res) => {
  try {
    const { title, content, author } = req.body;
    if (!title || !content || !author) {
      return res.status(400).json({ error: 'Title, content, and author are required' });
    }

    const slug = generateSlug(title);

    const existing = await get('SELECT id FROM posts WHERE slug = $1', [slug]);
    if (existing) {
      return res.status(409).json({ error: 'A post with a similar title already exists' });
    }

    const result = await run(
      'INSERT INTO posts (title, content, author, slug) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, content, author, slug]
    );

    res.status(201).json({
      message: 'Post created',
      id: result.lastInsertId,
      slug
    });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/posts/:id - update post
router.put('/posts/:id', async (req, res) => {
  try {
    const { title, content, author } = req.body;
    if (!title || !content || !author) {
      return res.status(400).json({ error: 'Title, content, and author are required' });
    }

    const id = parseInt(req.params.id);
    const post = await get('SELECT id FROM posts WHERE id = $1', [id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const slug = generateSlug(title);

    const conflict = await get('SELECT id FROM posts WHERE slug = $1 AND id != $2', [slug, id]);
    if (conflict) {
      return res.status(409).json({ error: 'A post with a similar title already exists' });
    }

    await run(
      'UPDATE posts SET title = $1, content = $2, author = $3, slug = $4, updated_at = NOW() WHERE id = $5',
      [title, content, author, slug, id]
    );

    res.json({ message: 'Post updated', slug });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/posts/:id - delete post
router.delete('/posts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await get('SELECT id FROM posts WHERE id = $1', [id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await run('DELETE FROM posts WHERE id = $1', [id]);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/posts/:id - single post for editing
router.get('/posts/:id', async (req, res) => {
  try {
    const post = await get('SELECT * FROM posts WHERE id = $1', [parseInt(req.params.id)]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  } catch (err) {
    console.error('Admin get post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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
