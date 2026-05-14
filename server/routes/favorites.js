const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { formatMediaFile } = require('../utils/helpers');

// Toggle favorite
router.post('/favorites', authenticateToken, async (req, res) => {
  try {
    const { id } = req.body;
    const userId = req.user.id;
    if (!id) return res.status(400).json({ error: 'Missing media ID' });

    const media = await db.get('SELECT id FROM media_files WHERE id = ?', [id]);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const existing = await db.get('SELECT id FROM favorites WHERE user_id = ? AND media_id = ?', [userId, id]);
    
    let newState;
    if (existing) {
      await db.run('DELETE FROM favorites WHERE id = ?', [existing.id]);
      newState = false;
    } else {
      await db.run('INSERT INTO favorites (user_id, media_id) VALUES (?, ?)', [userId, id]);
      newState = true;
    }

    res.json({ success: true, is_favorite: newState });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Get all favorites
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await db.all(
      `SELECT mf.*, c.key_name as category_key, c.display_name as category_display 
       FROM media_files mf 
       JOIN categories c ON mf.category_id = c.id 
       JOIN favorites f ON mf.id = f.media_id
       WHERE f.user_id = ?`,
      [userId]
    );
    res.json(favorites.map(row => ({ ...formatMediaFile(row), is_favorite: true })));
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

module.exports = router;
