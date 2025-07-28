const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { scanDirectoryWithCategories } = require('../utils/fileScanner');
const { generateThumbnail } = require('../utils/thumbnailGenerator');
const { authenticateToken } = require('../middleware/auth');
const rangeRequestHandler = require('../middleware/rangeRequest');

// Get all TV shows
router.get('/', authenticateToken, async (req, res) => {
    try {
        const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, '../../media');
        const categories = await scanDirectoryWithCategories(MEDIA_DIR);
        
        if (!categories.tv_shows) {
            return res.json([]);
        }
        
        // Return only show info without episodes for the main view
        const shows = categories.tv_shows.files.map(show => ({
            name: show.name,
            episodeCount: show.episodeCount,
            type: 'tvshow',
            category: show.category,
            categoryDisplay: show.categoryDisplay
        }));
        
        res.json(shows);
    } catch (error) {
        console.error('Error retrieving TV shows:', error);
        res.status(500).json({ error: 'Failed to retrieve TV shows' });
    }
});

// Get details of a specific TV show including episodes
router.get('/:showName', authenticateToken, async (req, res) => {
    try {
        const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, '../../media');
        const categories = await scanDirectoryWithCategories(MEDIA_DIR);
        
        if (!categories.tv_shows) {
            return res.status(404).json({ error: 'TV shows category not found' });
        }
        
        const show = categories.tv_shows.files.find(
            s => s.name.toLowerCase() === req.params.showName.toLowerCase()
        );
        
        if (!show) {
            return res.status(404).json({ error: 'TV show not found' });
        }
        
        res.json(show);
    } catch (error) {
        console.error('Error retrieving TV show details:', error);
        res.status(500).json({ error: 'Failed to retrieve TV show details' });
    }
});

// Get a thumbnail for a TV show
router.get('/:showName/thumbnail', authenticateToken, async (req, res) => {
    try {
        const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, '../../media');
        const categories = await scanDirectoryWithCategories(MEDIA_DIR);
        
        if (!categories.tv_shows) {
            return res.status(404).json({ error: 'TV shows category not found' });
        }
        
        const show = categories.tv_shows.files.find(
            s => s.name.toLowerCase() === req.params.showName.toLowerCase()
        );
        
        if (!show || !show.thumbnailPath) {
            return res.status(404).json({ error: 'TV show or thumbnail not found' });
        }
        
        const thumbnailPath = await generateThumbnail(show.thumbnailPath, show.name);
        
        if (!fs.existsSync(thumbnailPath)) {
            return res.status(404).json({ error: 'Thumbnail not found' });
        }
        
        res.sendFile(thumbnailPath);
    } catch (error) {
        console.error('Error retrieving TV show thumbnail:', error);
        res.status(500).json({ error: 'Failed to retrieve TV show thumbnail' });
    }
});

module.exports = router;