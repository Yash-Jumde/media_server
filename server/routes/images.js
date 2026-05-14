const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { resolveMediaRoot } = require('../utils/helpers');

// Image endpoint for direct image viewing
router.get('/images/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const file = await db.get('SELECT filepath FROM media_files WHERE id = ? AND media_type = ?', [id, 'image']);

    if (!file) {
      return res.status(404).send('Image not found');
    }

    const filePath = resolveMediaRoot(file.filepath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Image file missing from disk');
    }

    // Set appropriate content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving image file:', error);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
