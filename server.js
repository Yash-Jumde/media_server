const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { authenticateToken } = require('./server/middleware/auth');
const rangeRequestHandler = require('./server/middleware/rangeRequest');
const { generateThumbnail, transcodeVideo, createHLSStream } = require('./server/utils/thumbnailGenerator');
// const bcrypt = require('bcrypt');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { scanDirectory, scanDirectoryWithCategories, preprocessMedia, syncMediaWithDatabase } = require('./server/utils/fileScanner');
const db = require('./server/db');
const FileWatcher = require('./server/services/fileWatcher');
const TMDBScraper = require('./server/services/tmdbScraper');

require('dotenv').config();

// Initialize TMDB scraper (will be a no-op if no key is set)
const tmdb = new TMDBScraper(process.env.TMDB_API_KEY);
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is not defined in .env file');
  process.exit(1); // Exit with error
}

if (!process.env.ADMIN_PASSWORD) {
  console.error('ERROR: ADMIN_PASSWORD is not defined in .env file');
  process.exit(1); // Exit with error
}

const app = express();
const PORT = process.env.PORT || 3000;

// Media directory - change this to where your movies are stored
const MEDIA_DIR = path.join(__dirname, 'media');

// Middleware
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());

// Helper to format media file objects consistently for the frontend
function formatMediaFile(row, overrideCategoryKey = null, overrideCategoryName = null) {
  let thumbnailPath = null;
  if (row.media_type === 'video') {
    thumbnailPath = row.thumbnail_path || `/thumbnails/${path.basename(row.filepath, path.extname(row.filepath))}.jpg`;
  } else if (row.media_type === 'audio') {
    thumbnailPath = `/covers/${path.basename(row.filepath, path.extname(row.filepath))}.jpg`;
  } else if (row.media_type === 'image') {
    thumbnailPath = `/images/${row.id}`;
  }

  return {
    id: row.id,
    name: row.title || row.filename,
    path: row.filepath,
    type: row.media_type,
    size: row.file_size,
    thumbnail: thumbnailPath,
    category: overrideCategoryKey || row.category_key,
    categoryDisplay: overrideCategoryName || row.category_display,
    tmdb_poster_url: row.tmdb_poster_url,
    tmdb_backdrop_url: row.tmdb_backdrop_url,
    tmdb_rating: row.tmdb_rating,
    tmdb_genres: row.tmdb_genres,
    tmdb_release_date: row.tmdb_release_date,
    tmdb_overview: row.tmdb_overview,
    tmdb_cast: row.tmdb_cast,
    tmdb_runtime: row.tmdb_runtime,
    is_favorite: Boolean(row.is_favorite)
  };
}
// Redirect root to the new Next.js UI (port 3000)
app.get('/', (req, res) => {
  res.redirect('http://' + req.hostname + ':3000');
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { password } = req.body;

  if (password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { user: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.use('/covers', express.static(path.join(__dirname, 'covers')));

// Updated media endpoint to return categorized data
app.get('/api/media', authenticateToken, async (req, res) => {
  try {
    const categoriesRows = await db.all('SELECT * FROM categories');
    const categories = {};

    for (const cat of categoriesRows) {
      categories[cat.key_name] = {
        name: cat.display_name,
        files: [],
        series: {}
      };
    }

    const filesRows = await db.all('SELECT * FROM media_files');
    const seriesRows = await db.all('SELECT * FROM series');

    const seriesMap = {};
    seriesRows.forEach(s => seriesMap[s.id] = s);

    for (const row of filesRows) {
      const cat = categoriesRows.find(c => c.id === row.category_id);
      if (!cat) continue;

      const fileObj = formatMediaFile(row, cat.key_name, cat.display_name);

      if (row.series_id && cat.key_name === 'tv_shows') {
        const sName = seriesMap[row.series_id].name;
        if (!categories[cat.key_name].series[sName]) {
          categories[cat.key_name].series[sName] = {
            name: sName,
            episodes: [],
            type: 'tv_series'
          };
        }
        fileObj.seriesName = sName;
        fileObj.episodeNum = row.episode_num;
        fileObj.seasonNum = row.season_num;
        categories[cat.key_name].series[sName].episodes.push(fileObj);
        categories[cat.key_name].files.push(fileObj);
      } else {
        categories[cat.key_name].files.push(fileObj);
      }
    }

    res.json(categories);
  } catch (error) {
    console.error('Error fetching media from database:', error);
    res.status(500).json({ error: 'Failed to retrieve media files' });
  }
});

// New endpoint to trigger a manual library scan
app.get('/api/scan', authenticateToken, async (req, res) => {
  try {
    await syncMediaWithDatabase(MEDIA_DIR);
    // Trigger TMDB scrape in background after sync
    tmdb.scrapeAll().catch(err => console.error('[TMDB] Background scrape error:', err));
    res.json({ success: true, message: 'Library updated successfully' });
  } catch (error) {
    console.error('Error during manual scan:', error);
    res.status(500).json({ error: 'Failed to scan library' });
  }
});

// Trigger TMDB metadata scrape
app.get('/api/scrape', authenticateToken, async (req, res) => {
  try {
    tmdb.scrapeAll().catch(err => console.error('[TMDB] Scrape error:', err));
    res.json({ success: true, message: 'Metadata scrape started in background' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start scrape' });
  }
});

// Toggle favorite
app.post('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing media ID' });

    const media = await db.get('SELECT id, is_favorite FROM media_files WHERE id = ?', [id]);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const newState = !media.is_favorite;
    await db.run('UPDATE media_files SET is_favorite = ? WHERE id = ?', [newState, media.id]);

    res.json({ success: true, is_favorite: newState });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Get all favorites
app.get('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const favorites = await db.all(
      `SELECT mf.*, c.key_name as category_key, c.display_name as category_display 
       FROM media_files mf 
       JOIN categories c ON mf.category_id = c.id 
       WHERE mf.is_favorite = 1`
    );
    res.json(favorites.map(row => formatMediaFile(row)));
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Get recently watched
app.get('/api/recent', authenticateToken, async (req, res) => {
  try {
    const recent = await db.all(
      `SELECT mf.*, wh.progress, wh.last_watched, c.key_name as category_key, c.display_name as category_display
       FROM watch_history wh
       JOIN media_files mf ON wh.media_id = mf.id
       JOIN categories c ON mf.category_id = c.id
       ORDER BY wh.last_watched DESC LIMIT 20`
    );
    res.json(recent.map(row => formatMediaFile(row)));
  } catch (error) {
    console.error('Error fetching recent:', error);
    res.status(500).json({ error: 'Failed to fetch recent items' });
  }
});

app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));

// Endpoint to load subtitles.
app.get('/subtitles/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const mediaFile = await db.get('SELECT filepath FROM media_files WHERE id = ? AND media_type = ?', [id, 'video']);

    if (!mediaFile) {
      return res.status(404).send('Media file not found');
    }

    const mediaPath = mediaFile.filepath;
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

// Image endpoint for direct image viewing
app.get('/images/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const file = await db.get('SELECT filepath FROM media_files WHERE id = ? AND media_type = ?', [id, 'image']);

    if (!file) {
      return res.status(404).send('Image not found');
    }

    const filePath = file.filepath;
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

// Streaming endpoint
app.get('/stream/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const file = await db.get('SELECT filepath, media_type FROM media_files WHERE id = ? AND (media_type = ? OR media_type = ?)', [id, 'video', 'audio']);

    if (!file) {
      return res.status(404).send('Media file not found');
    }

    const filePath = file.filepath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Media file missing from disk');
    }

    const ext = path.extname(filePath).toLowerCase();
    
    // Check if we should transcode based on browser support
    // For now, we transcode .mkv to ensure compatibility across all browsers/mobile
    if (ext === '.mkv' || ext === '.avi' || ext === '.wmv') {
      console.log(`[Stream] Transcoding on-the-fly: ${path.basename(filePath)}`);
      
      res.setHeader('Content-Type', 'video/mp4');
      
      const ffmpeg = require('fluent-ffmpeg');
      const stream = ffmpeg(filePath)
        .format('mp4')
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-movflags frag_keyframe+empty_moov+default_base_moof',
          '-preset ultrafast',
          '-tune zerolatency',
          '-crf 23',
          '-pix_fmt yuv420p'
        ])
        .on('error', (err) => {
          if (err.message.includes('SIGKILL') || err.message.includes('Output stream closed')) {
            return; // Client disconnected
          }
          console.error('[FFmpeg] Error:', err.message);
        });

      // Handle seeking if range request is present (simplified for on-the-fly)
      if (req.headers.range) {
        // Basic seeking support could be added here by parsing range and using -ss
      }

      stream.pipe(res, { end: true });
    } else {
      // Native support (mp4, webm, mp3) - use Direct Stream
      return rangeRequestHandler(req, res, filePath);
    }
  } catch (error) {
    console.error('Error streaming file:', error);
    res.status(500).send('Internal server error');
  }
});

// TV Shows specific endpoint for getting series details
app.get('/api/tv-shows/:seriesName', authenticateToken, async (req, res) => {
  try {
    const seriesName = decodeURIComponent(req.params.seriesName);
    const { getTvSeriesDetails } = require('./server/utils/fileScanner');
    const { generateThumbnail } = require('./server/utils/thumbnailGenerator');

    const seriesDetails = await getTvSeriesDetails(MEDIA_DIR, seriesName);

    if (!seriesDetails) {
      return res.status(404).json({ error: 'TV series not found' });
    }

    // Generate thumbnails for episodes
    for (const episode of seriesDetails.episodes) {
      if (episode.type === 'video') {
        try {
          const thumbnailPath = await generateThumbnail(episode.path, episode.name);
          episode.thumbnail = `/thumbnails/${path.basename(thumbnailPath)}`;
        } catch (err) {
          console.error(`Failed to generate thumbnail for ${episode.name}:`, err);
          episode.thumbnail = null;
        }
      }
    }

    res.json(seriesDetails);
  } catch (error) {
    console.error('Error retrieving TV series details:', error);
    res.status(500).json({ error: 'Failed to retrieve TV series details' });
  }
});

// Get all TV series (summary view)
app.get('/api/tv-shows', authenticateToken, async (req, res) => {
  try {
    const { scanTvShowsDirectory } = require('./server/utils/fileScanner');
    const { generateThumbnail } = require('./server/utils/thumbnailGenerator');

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

// Get watch progress
app.get('/api/progress/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const progress = await db.get('SELECT progress FROM watch_history WHERE media_id = ?', [id]);
    res.json({ progress: progress ? progress.progress : 0 });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Update watch progress
app.post('/api/progress', authenticateToken, async (req, res) => {
  try {
    const { id, progress } = req.body;
    if (!id || progress === undefined) return res.status(400).json({ error: 'Missing ID or progress' });

    const media = await db.get('SELECT id FROM media_files WHERE id = ?', [id]);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const existing = await db.get('SELECT id FROM watch_history WHERE media_id = ?', [media.id]);
    if (existing) {
      await db.run('UPDATE watch_history SET progress = ?, last_watched = CURRENT_TIMESTAMP WHERE id = ?', [progress, existing.id]);
    } else {
      await db.run('INSERT INTO watch_history (media_id, progress, last_watched) VALUES (?, ?, CURRENT_TIMESTAMP)', [media.id, progress]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});


// Start server
app.listen(PORT, '0.0.0.0', () => {
  const networkInterfaces = require('os').networkInterfaces();

  // Loop through all network interfaces
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    // Find IPv4 non-internal addresses
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }

  console.log(`\n🚀 Media Server is running!`);
  console.log(`-------------------------------------------`);
  console.log(`📺 Frontend UI: http://localhost:3000`);
  console.log(`📡 Backend API: http://localhost:${PORT}`);
  if (typeof localIP !== 'undefined') {
    console.log(`🌐 Network UI:  http://${localIP}:3000`);
  }
  console.log(`-------------------------------------------\n`);

  // Run the initialization in a self-executing async function
  (async () => {
    try {
      await db.initializeDatabase();

      // Start real-time file watcher
      const watcher = new FileWatcher(MEDIA_DIR);
      watcher.start();

      console.log('Server initialized. Services running:');
      console.log('  - SQLite Database: active');
      console.log('  - File Watcher: active');
      console.log(`  - TMDB Scraper: ${tmdb.enabled ? 'active' : 'disabled (no API key)'}`);
      console.log('  - Access /api/scan to refresh the library.');

      // Start background metadata scraping if enabled
      if (tmdb.enabled) {
        console.log('[TMDB] Starting background scrape...');
        tmdb.scrapeAll().catch(err => console.error('[TMDB] Startup scrape error:', err));
      }
    } catch (err) {
      console.error('Error during server initialization:', err);
    }
  })();
});