const express = require('express');
const router = express.Router();
const path = require('path');
const { syncMediaWithDatabase } = require('../utils/fileScanner');
const { authenticateToken } = require('../middleware/auth');

const MEDIA_DIR = path.join(__dirname, '../../media');

// New endpoint to trigger a manual library scan
router.get('/scan', authenticateToken, async (req, res) => {
  try {
    await syncMediaWithDatabase(MEDIA_DIR);
    if (req.tmdb && req.tmdb.enabled) {
      req.tmdb.scrapeAll().catch(err => console.error('[TMDB] Background scrape error:', err));
    }
    res.json({ success: true, message: 'Library updated successfully' });
  } catch (error) {
    console.error('Error during manual scan:', error);
    res.status(500).json({ error: 'Failed to scan library' });
  }
});

// Trigger TMDB metadata scrape
router.get('/scrape', authenticateToken, async (req, res) => {
  try {
    if (req.tmdb && req.tmdb.enabled) {
      req.tmdb.scrapeAll().catch(err => console.error('[TMDB] Scrape error:', err));
      res.json({ success: true, message: 'Metadata scrape started in background' });
    } else {
      res.status(400).json({ error: 'TMDB scraping is not configured' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to start scrape' });
  }
});

module.exports = router;
