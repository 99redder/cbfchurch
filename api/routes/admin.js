const express = require('express');
const router = express.Router();
const { get, all, run } = require('../utils/db');
const { requireAuth, requireSuperAdmin } = require('../utils/auth');
const { saveGalleryImage, deleteGalleryImage, attachPublicUrl } = require('../utils/storage');

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

// GET /api/admin/users - list all users (superadmin only)
router.get('/users', requireSuperAdmin, async (req, res) => {
  try {
    const users = await all(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(users);
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id - delete a user (superadmin only, cannot delete self)
router.delete('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (id === req.user.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const user = await get('SELECT id FROM users WHERE id = $1', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await run('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/gallery - upload a new gallery photo
router.post('/gallery', async (req, res) => {
  try {
    const { imageData, alt } = req.body || {};
    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const match = imageData.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const mime = match[1].toLowerCase();
    const ext = mime.includes('jpeg') ? 'jpg' : mime.split('/')[1];
    const base64Data = match[3];
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large (max 4MB)' });
    }

    const { filename, storageKey, url } = await saveGalleryImage({ buffer, mime, ext });

    const result = await run(
      'INSERT INTO gallery_photos (filename, alt, position, storage_key, url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [filename, (alt || '').trim(), Date.now(), storageKey, url]
    );

    res.status(201).json({
      message: 'Photo uploaded',
      id: result.lastInsertId,
      filename,
      url: url || ''
    });
  } catch (err) {
    console.error('Upload gallery photo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/gallery - list gallery photos (admin/superadmin)
router.get('/gallery', async (req, res) => {
  try {
    const photos = await all(
      'SELECT id, filename, alt, position, created_at, storage_key, url FROM gallery_photos ORDER BY position ASC, created_at DESC'
    );
    res.json(photos.map(attachPublicUrl));
  } catch (err) {
    console.error('Admin get gallery photos error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/gallery/reorder - reorder gallery photos
router.put('/gallery/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: 'orderedIds is required' });
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const id = parseInt(orderedIds[i]);
      if (Number.isNaN(id)) continue;
      await run('UPDATE gallery_photos SET position = $1 WHERE id = $2', [i + 1, id]);
    }

    res.json({ message: 'Gallery order updated' });
  } catch (err) {
    console.error('Reorder gallery photos error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/gallery/:id - delete gallery photo
router.delete('/gallery/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const photo = await get('SELECT filename, storage_key FROM gallery_photos WHERE id = $1', [id]);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    await run('DELETE FROM gallery_photos WHERE id = $1', [id]);
    await deleteGalleryImage({ filename: photo.filename, storageKey: photo.storage_key });

    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Delete gallery photo error:', err);
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
