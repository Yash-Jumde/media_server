const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { formatMediaFile } = require('../utils/helpers');

// TV Shows specific endpoint for getting series details
router.get('/tv-shows/:seriesName', authenticateToken, async (req, res) => {
  try {
    const seriesName = decodeURIComponent(req.params.seriesName);
    const userId = req.user.id;
    
    // Fetch series details from DB
    const seriesData = await db.get('SELECT * FROM series WHERE name = ?', [seriesName]);
    if (!seriesData) {
      return res.status(404).json({ error: 'TV series not found' });
    }

    // Fetch episodes from DB
    const episodesData = await db.all(
      `SELECT mf.*, c.key_name as category_key, c.display_name as category_display, f.id as favorite_id
       FROM media_files mf 
       JOIN categories c ON mf.category_id = c.id 
       LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
       WHERE mf.series_id = ?
       ORDER BY mf.season_num ASC, mf.episode_num ASC`,
      [userId, seriesData.id]
    );

    // Format episodes and group by season
    const seasons = {};
    const formattedEpisodes = [];
    
    for (const row of episodesData) {
      const ep = formatMediaFile(row, row.category_key, row.category_display);
      ep.is_favorite = !!row.favorite_id;
      ep.seriesName = seriesData.name;
      ep.seasonNum = row.season_num || 1;
      ep.episodeNum = row.episode_num;
      
      formattedEpisodes.push(ep);
      
      if (!seasons[ep.seasonNum]) {
        seasons[ep.seasonNum] = [];
      }
      seasons[ep.seasonNum].push(ep);
    }
    
    // Convert seasons object to array for easier frontend rendering
    const seasonsArray = Object.keys(seasons).sort((a, b) => parseInt(a) - parseInt(b)).map(seasonNum => ({
      seasonNum: parseInt(seasonNum),
      episodes: seasons[seasonNum]
    }));

    res.json({
      ...seriesData,
      id: seriesData.name, // Keep id as name for frontend routing consistency
      type: 'series',
      title: seriesData.name,
      episodes: formattedEpisodes, // Flat list if needed
      seasons: seasonsArray // Grouped by season
    });
  } catch (error) {
    console.error('Error retrieving TV series details:', error);
    res.status(500).json({ error: 'Failed to retrieve TV series details' });
  }
});

// Get all TV series (summary view)
router.get('/tv-shows', authenticateToken, async (req, res) => {
  try {
    const path = require('path');
    const { scanTvShowsDirectory } = require('../utils/fileScanner');
    const { generateThumbnail } = require('../utils/thumbnailGenerator');
    const MEDIA_DIR = path.join(__dirname, '../../media');

    const tvShowsPath = path.join(MEDIA_DIR, 'tv_shows');
    const series = await scanTvShowsDirectory(tvShowsPath);

    // Convert to array and add thumbnail for first episode of each series
    const seriesArray = await Promise.all(
      Object.values(series).map(async (s) => {
        let thumbnail = null;

        // Try to get thumbnail from first episode
        if (s.episodes.length > 0) {
          const firstEpisode = s.episodes[0];
          try {
            const thumbnailPath = await generateThumbnail(firstEpisode.path, firstEpisode.name);
            thumbnail = `/thumbnails/${path.basename(thumbnailPath)}`;
          } catch (err) {
            console.error(`Failed to generate thumbnail for ${firstEpisode.name}:`, err);
          }
        }

        return {
          name: s.name,
          episodeCount: s.episodes.length,
          thumbnail: thumbnail,
          type: 'tv_series'
        };
      })
    );

    res.json(seriesArray);
  } catch (error) {
    console.error('Error retrieving TV shows:', error);
    res.status(500).json({ error: 'Failed to retrieve TV shows' });
  }
});

// Get most recent episode watched for a series (for Resume button)
router.get('/series-resume/:seriesName', authenticateToken, async (req, res) => {
  try {
    const seriesName = decodeURIComponent(req.params.seriesName);
    const userId = req.user.id;
    let row = await db.get(`
      SELECT mf.*, wh.progress, wh.last_watched, c.key_name as category_key, c.display_name as category_display, f.id as favorite_id
      FROM watch_history wh
      JOIN media_files mf ON wh.media_id = mf.id
      JOIN series s ON mf.series_id = s.id
      JOIN categories c ON mf.category_id = c.id
      LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
      WHERE s.name = ? AND wh.user_id = ?
      ORDER BY wh.last_watched DESC LIMIT 1
    `, [userId, seriesName, userId]);

    if (!row) return res.json(null);
    
    // If progress is >= 95% of duration, or video is practically over (within 60s), suggest the next episode
    const isFinished = row.duration && (row.progress >= row.duration * 0.95 || row.duration - row.progress <= 60);
    
    if (isFinished) {
      const nextEpisode = await db.get(`
        SELECT mf.*, c.key_name as category_key, c.display_name as category_display, f.id as favorite_id
        FROM media_files mf
        JOIN categories c ON mf.category_id = c.id
        LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
        WHERE mf.series_id = ? 
          AND (mf.season_num > ? OR (mf.season_num = ? AND mf.episode_num > ?))
        ORDER BY mf.season_num ASC, mf.episode_num ASC
        LIMIT 1
      `, [userId, row.series_id, row.season_num, row.season_num, row.episode_num]);
      
      if (nextEpisode) {
        // Find if next episode has some progress
        const nextProg = await db.get('SELECT progress FROM watch_history WHERE media_id = ? AND user_id = ?', [nextEpisode.id, userId]);
        nextEpisode.progress = nextProg ? nextProg.progress : 0;
        nextEpisode.is_favorite = !!nextEpisode.favorite_id;
        row = nextEpisode;
      } else {
        // Finished the series, just return the current one but from the beginning
        row.progress = 0;
        row.is_favorite = !!row.favorite_id;
      }
    } else {
      row.is_favorite = !!row.favorite_id;
    }

    const fileObj = formatMediaFile(row);
    fileObj.is_favorite = !!row.favorite_id;
    res.json(fileObj);
  } catch (error) {
    console.error('Error fetching series resume data:', error);
    res.status(500).json({ error: 'Failed to fetch series resume' });
  }
});

module.exports = router;