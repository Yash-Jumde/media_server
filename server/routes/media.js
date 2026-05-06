const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { formatMediaFile } = require('../utils/helpers');
const QueryBuilder = require('../services/queryBuilder');
const TranscodeManager = require('../services/transcodeManager');

// Get transcoding queue status
router.get('/transcode/queue', authenticateToken, async (req, res) => {
  try {
    res.json(await TranscodeManager.getQueueStatus());
  } catch (error) {
    console.error('Error fetching transcode queue:', error);
    res.status(500).json({ error: 'Failed to fetch transcode queue' });
  }
});

// Unified exploration endpoint
router.get('/media/explore', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, genre, sort, order, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await QueryBuilder.buildExploreQuery(userId, {
      category, genre, sort, order, search, limit, offset
    });

    // Format results
    result.items = result.items.map(row => {
      if (row.episode_count !== undefined) {
        // It's a series
        return {
          ...row,
          id: row.name,
          db_id: row.id,
          type: 'series',
          title: row.name,
          thumbnail: row.tmdb_poster_url || row.poster_path,
          is_favorite: !!row.favorite_id
        };
      } else {
        // It's a media file
        const fileObj = formatMediaFile(row, row.category_key, row.category_display);
        fileObj.is_favorite = !!row.favorite_id;
        return fileObj;
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error in /explore:', error);
    res.status(500).json({ error: 'Failed to explore media' });
  }
});

// Updated media endpoint to return categorized data or paginated category results
router.get('/media', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (category) {
      const catRow = await db.get('SELECT * FROM categories WHERE key_name = ?', [category]);
      if (!catRow) return res.status(404).json({ error: 'Category not found' });

      if (category === 'tv_shows') {
        const seriesCountRes = await db.get('SELECT COUNT(*) as total FROM series');
        const totalCount = seriesCountRes.total;

        const seriesRows = await db.all(`
          SELECT s.*, f.id as favorite_id
          FROM series s
          LEFT JOIN favorites f ON f.media_id = (
            SELECT id FROM media_files WHERE series_id = s.id LIMIT 1
          ) AND f.user_id = ?
          ORDER BY s.name ASC
          LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), parseInt(offset)]);

        const items = seriesRows.map(s => ({
          ...s,
          id: s.name,
          db_id: s.id,
          type: 'series',
          title: s.name,
          thumbnail: s.tmdb_poster_url || s.poster_path,
          is_favorite: !!s.favorite_id
        }));

        return res.json({
          items,
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / limit)
        });
      } else {
        const countRes = await db.get('SELECT COUNT(*) as total FROM media_files WHERE category_id = ?', [catRow.id]);
        const totalCount = countRes.total;

        const filesRows = await db.all(`
          SELECT mf.*, f.id as favorite_id 
          FROM media_files mf
          LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
          WHERE mf.category_id = ?
          ORDER BY mf.created_at DESC
          LIMIT ? OFFSET ?
        `, [userId, catRow.id, parseInt(limit), parseInt(offset)]);

        const items = filesRows.map(row => {
          const fileObj = formatMediaFile(row, catRow.key_name, catRow.display_name);
          fileObj.is_favorite = !!row.favorite_id;
          return fileObj;
        });

        return res.json({
          items,
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / limit)
        });
      }
    }

    const categoriesRows = await db.all('SELECT * FROM categories');
    const result = {};

    for (const cat of categoriesRows) {
      const categoryData = {
        name: cat.display_name,
        files: [],
        series: {}
      };

      if (cat.key_name === 'tv_shows') {
        // Fetch recent series
        const seriesRows = await db.all(`
          SELECT s.*, f.id as favorite_id
          FROM series s
          LEFT JOIN favorites f ON f.media_id = (SELECT id FROM media_files WHERE series_id = s.id LIMIT 1) AND f.user_id = ?
          ORDER BY s.created_at DESC LIMIT 20
        `, [userId]);

        seriesRows.forEach(s => {
          categoryData.series[s.name] = {
            ...s,
            id: s.name,
            db_id: s.id,
            type: 'series',
            title: s.name,
            thumbnail: s.tmdb_poster_url || s.poster_path,
            is_favorite: !!s.favorite_id,
            files: [] // Empty for home view summary
          };
          categoryData.files.push(categoryData.series[s.name]);
        });
      } else {
        // Fetch recent files for other categories
        const filesRows = await db.all(`
          SELECT mf.*, f.id as favorite_id 
          FROM media_files mf
          LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
          WHERE mf.category_id = ?
          ORDER BY mf.created_at DESC LIMIT 20
        `, [userId, cat.id]);

        categoryData.files = filesRows.map(row => {
          const fileObj = formatMediaFile(row, cat.key_name, cat.display_name);
          fileObj.is_favorite = !!row.favorite_id;
          return fileObj;
        });
      }

      result[cat.key_name] = categoryData;
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching media from database:', error);
    res.status(500).json({ error: 'Failed to retrieve media files' });
  }
});

// Get a single media item by ID
router.get('/media/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    if (id === 'next') return; // let the other route handle it
    const row = await db.get(
      `SELECT mf.*, c.key_name as category_key, c.display_name as category_display, s.name as series_name, f.id as favorite_id
       FROM media_files mf 
       JOIN categories c ON mf.category_id = c.id 
       LEFT JOIN series s ON mf.series_id = s.id
       LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
       WHERE mf.id = ?`,
      [userId, id]
    );

    if (!row) return res.status(404).json({ error: 'Media not found' });

    const fileObj = formatMediaFile(row);
    fileObj.is_favorite = !!row.favorite_id;
    res.json(fileObj);
  } catch (error) {
    console.error('Error fetching single media item:', error);
    res.status(500).json({ error: 'Failed to retrieve media item' });
  }
});

// Get next episode for a given media id
router.get('/media/:id/next', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;
    const current = await db.get('SELECT series_id, season_num, episode_num FROM media_files WHERE id = ?', [id]);
    
    if (!current || !current.series_id) {
      return res.json(null); // Not a TV episode
    }
    
    const nextEpisode = await db.get(`
      SELECT mf.*, c.key_name as category_key, c.display_name as category_display, f.id as favorite_id
      FROM media_files mf
      JOIN categories c ON mf.category_id = c.id
      LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
      WHERE mf.series_id = ? 
        AND (mf.season_num > ? OR (mf.season_num = ? AND mf.episode_num > ?))
      ORDER BY mf.season_num ASC, mf.episode_num ASC
      LIMIT 1
    `, [userId, current.series_id, current.season_num, current.season_num, current.episode_num]);
    
    if (!nextEpisode) return res.json(null);
    
    const fileObj = formatMediaFile(nextEpisode);
    fileObj.is_favorite = !!nextEpisode.favorite_id;
    res.json(fileObj);
  } catch (error) {
    console.error('Error fetching next episode:', error);
    res.status(500).json({ error: 'Failed to fetch next episode' });
  }
});

// Get recently watched
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const recent = await db.all(
      `SELECT mf.*, wh.progress, wh.last_watched, c.key_name as category_key, c.display_name as category_display, s.name as series_name, s.tmdb_poster_url as series_poster, s.tmdb_genres as series_genres, f.id as favorite_id
       FROM watch_history wh
       JOIN media_files mf ON wh.media_id = mf.id
       JOIN categories c ON mf.category_id = c.id
       LEFT JOIN series s ON mf.series_id = s.id
       LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
       WHERE wh.user_id = ?
       ORDER BY wh.last_watched DESC LIMIT 50`,
       [userId, userId]
    );
    
    const result = [];
    const seenSeries = new Set();
    
    for (const row of recent) {
      if (row.series_id) {
        if (!seenSeries.has(row.series_id)) {
          seenSeries.add(row.series_id);
          result.push({
            id: row.series_name,
            name: row.series_name,
            title: row.series_name,
            type: 'series',
            thumbnail: row.series_poster || row.thumbnail_path,
            tmdb_poster_url: row.series_poster,
            tmdb_genres: row.series_genres,
            is_favorite: !!row.favorite_id
          });
        }
      } else {
        const fileObj = formatMediaFile(row);
        fileObj.is_favorite = !!row.favorite_id;
        result.push(fileObj);
      }
      if (result.length >= 20) break;
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching recent:', error);
    res.status(500).json({ error: 'Failed to fetch recent items' });
  }
});

// Get recommendations for a media item or series
router.get('/recommendations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let targetGenres = '';
    let targetType = '';
    let targetId = id;

    if (!isNaN(id) && id.trim() !== '') {
      const row = await db.get('SELECT tmdb_genres FROM media_files WHERE id = ?', [id]);
      if (row) {
        targetGenres = row.tmdb_genres;
        targetType = 'media';
      }
    } else {
      const row = await db.get('SELECT tmdb_genres FROM series WHERE name = ?', [decodeURIComponent(id)]);
      if (row) {
        targetGenres = row.tmdb_genres;
        targetType = 'series';
      }
    }

    if (!targetGenres) return res.json([]);

    const genresList = targetGenres.split(',').map(g => g.trim().toLowerCase()).filter(Boolean);
    if (genresList.length === 0) return res.json([]);

    const allMovies = await db.all(`
      SELECT mf.*, c.key_name as category_key, c.display_name as category_display, f.id as favorite_id
      FROM media_files mf
      JOIN categories c ON mf.category_id = c.id
      LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
      WHERE mf.tmdb_genres IS NOT NULL
    `, [userId]);

    const allSeries = await db.all(`
      SELECT * FROM series WHERE tmdb_genres IS NOT NULL
    `);

    const recommendations = [];

    for (const movie of allMovies) {
      if (targetType === 'media' && movie.id == targetId) continue;
      
      const movieGenres = (movie.tmdb_genres || '').split(',').map(g => g.trim().toLowerCase());
      const intersection = genresList.filter(g => movieGenres.includes(g));
      
      if (intersection.length > 0) {
        const fileObj = formatMediaFile(movie);
        fileObj.is_favorite = !!movie.favorite_id;
        recommendations.push({
          item: fileObj,
          score: intersection.length + (movie.tmdb_rating / 10)
        });
      }
    }

    for (const s of allSeries) {
      if (targetType === 'series' && s.name === decodeURIComponent(targetId)) continue;

      const seriesGenres = (s.tmdb_genres || '').split(',').map(g => g.trim().toLowerCase());
      const intersection = genresList.filter(g => seriesGenres.includes(g));

      if (intersection.length > 0) {
        recommendations.push({
          item: {
            ...s,
            id: s.name,
            type: 'series',
            title: s.name,
            thumbnail: s.tmdb_poster_url || s.poster_path
          },
          score: intersection.length + (s.tmdb_rating / 10)
        });
      }
    }

    const sorted = recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(r => r.item);

    res.json(sorted);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to retrieve recommendations' });
  }
});

module.exports = router;
