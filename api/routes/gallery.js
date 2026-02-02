const express = require('express');
const router = express.Router();
const { all } = require('../utils/db');
const { attachPublicUrl } = require('../utils/storage');

// GET /api/gallery - public list of uploaded gallery photos
router.get('/', async (req, res) => {
  try {
    const photos = await all(
      'SELECT id, filename, alt, created_at, storage_key, url FROM gallery_photos ORDER BY position ASC, created_at DESC'
    );
    res.json(photos.map(attachPublicUrl));
  } catch (err) {
    console.error('Get gallery photos error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
