const express = require('express');
const router = express.Router();
const { get } = require('../utils/db');

router.get('/:key', async (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ error: 'Content key is required' });

    const row = await get('SELECT key, value_json, updated_at FROM site_content WHERE key = $1', [key]);
    if (!row) return res.json({ key, value: null });

    res.json({ key: row.key, value: row.value_json, updatedAt: row.updated_at });
  } catch (err) {
    console.error('Get site content error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
