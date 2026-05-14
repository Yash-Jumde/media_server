const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { resolveMediaRoot } = require('../utils/helpers');

// Endpoint to load subtitles (supports HEAD for availability check).
router.head('/subtitles/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const mediaFile = await db.get('SELECT filepath FROM media_files WHERE id = ? AND media_type = ?', [id, 'video']);
    if (!mediaFile) return res.status(404).end();

    const mediaPath = resolveMediaRoot(mediaFile.filepath);
    const mediaDir = path.dirname(mediaPath);

    try {
      const files = fs.readdirSync(mediaDir);
      const hasSubtitle = files.some(f => f.toLowerCase().endsWith('.vtt') || f.toLowerCase().endsWith('.srt'));
      if (hasSubtitle) {
        res.setHeader('Content-Type', 'text/vtt');
        return res.status(200).end();
      }
    } catch (e) { /* directory read error */ }

    res.status(404).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/subtitles/:id', authenticateToken, async (req, res) => {

  try {
    const id = req.params.id;
    const mediaFile = await db.get('SELECT filepath FROM media_files WHERE id = ? AND media_type = ?', [id, 'video']);

    if (!mediaFile) {
      return res.status(404).send('Media file not found');
    }

    const mediaPath = resolveMediaRoot(mediaFile.filepath);
    const mediaDir = path.dirname(mediaPath);

    try {
      const files = fs.readdirSync(mediaDir);
      
      // 1. Try to find a .vtt file first (native format)
      const vttFile = files.find(f => f.toLowerCase().endsWith('.vtt'));
      if (vttFile) {
        const vttPath = path.join(mediaDir, vttFile);
        res.setHeader('Content-Type', 'text/vtt');
        return res.sendFile(vttPath);
      }

      // 2. Fallback to .srt file and convert on-the-fly
      const srtFile = files.find(f => f.toLowerCase().endsWith('.srt'));
      if (srtFile) {
        const srtPath = path.join(mediaDir, srtFile);
        let srtContent = fs.readFileSync(srtPath, 'utf8');

        // Remove Byte Order Mark (BOM) if present
        srtContent = srtContent.replace(/^\uFEFF/, '');

        // Convert SRT to VTT format
        const vttContent = 'WEBVTT\n\n' + srtContent
          .replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2')  // Replace comma with dot in timestamps
          .replace(/\r\n/g, '\n');                         // Normalize line endings

        res.setHeader('Content-Type', 'text/vtt');
        return res.send(vttContent);
      }
    } catch (e) {
      console.error('Error reading media directory for subtitles:', e);
    }

    // No subtitle file found
    res.status(404).send('Subtitle file not found');
  } catch (error) {
    console.error('Error serving subtitle file:', error);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
