const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get watch progress
router.get('/progress/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;
    const progress = await db.get('SELECT progress FROM watch_history WHERE media_id = ? AND user_id = ?', [id, userId]);
    res.json({ progress: progress ? progress.progress : 0 });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Update watch progress
router.post('/progress', authenticateToken, async (req, res) => {
  try {
    const { id, progress } = req.body;
    const userId = req.user.id;
    if (!id || progress === undefined) {
      console.warn(`[Progress] Missing ID or progress for user ${userId}`);
      return res.status(400).json({ error: 'Missing ID or progress' });
    }

    // Ensure progress is a rounded integer
    const progressInt = Math.round(progress);

    const media = await db.get('SELECT id, title FROM media_files WHERE id = ?', [id]);
    if (!media) {
      console.warn(`[Progress] Media ID ${id} not found`);
      return res.status(404).json({ error: 'Media not found' });
    }

    const existing = await db.get('SELECT id, progress FROM watch_history WHERE media_id = ? AND user_id = ?', [media.id, userId]);
    if (existing) {
      if (Math.abs(existing.progress - progressInt) > 0) {
        await db.run('UPDATE watch_history SET progress = ?, last_watched = CURRENT_TIMESTAMP WHERE id = ?', [progressInt, existing.id]);
        // console.log(`[Progress] Updated: "${media.title}" for user ${userId} to ${progressInt}s`);
      }
    } else {
      await db.run('INSERT INTO watch_history (media_id, user_id, progress, last_watched) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [media.id, userId, progressInt]);
      console.log(`[Progress] New record: "${media.title}" for user ${userId} at ${progressInt}s`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Progress] Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

module.exports = router;
