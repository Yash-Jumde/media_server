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
const { scanDirectory, scanDirectoryWithCategories, preprocessMedia } = require('./server/utils/fileScanner');

require('dotenv').config();
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
app.use(express.static(path.join(__dirname, 'client/public')));

// Login endpoint
app.post('/api/login', async (req, res) => {
  const {password} = req.body;

  if(password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      {user: 'admin'},
      process.env.JWT_SECRET,
      {expiresIn: '24h'}
    );

    res.json({token});
  } else {
    res.status(401).json({error: 'Invalid password'});
  }
});

app.use('/covers', express.static(path.join(__dirname, 'covers')));

// Updated media endpoint to return categorized data
app.get('/api/media', authenticateToken, async (req, res) => {
  try {
    const categories = await scanDirectoryWithCategories(MEDIA_DIR);
   
    // Generate thumbnails for each category
    for (const [categoryKey, category] of Object.entries(categories)) {
      for (const file of category.files) {
        if (file.type === 'video') {
          try {
            const thumbnailPath = await generateThumbnail(file.path, file.name);
            file.thumbnail = `/thumbnails/${path.basename(thumbnailPath)}`;
          } catch (err) {
            console.error(`Failed to generate thumbnail for ${file.name}:`, err);
            file.thumbnail = null;
          }
        } else if (file.type === 'audio') {
          // Check if cover art exists
          const ext = path.extname(file.name);
          const baseName = path.basename(file.name, ext);
          const coverPath = path.join(__dirname, 'covers', `${baseName}.jpg`);
         
          if (fs.existsSync(coverPath)) {
            file.thumbnail = `/covers/${baseName}.jpg`;
          } else {
            file.thumbnail = null;
          }
        }
      }
    }

    res.json(categories);
  } catch (error) {
    console.error('Error scanning media directory:', error);
    res.status(500).json({ error: 'Failed to retrieve media files' });
  }
});

app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));

// Endpoint to load subtitles.
app.get('/subtitles/:filename', authenticateToken, async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const categories = await scanDirectoryWithCategories(MEDIA_DIR);
   
    // Find the corresponding media file across all categories
    let mediaFile = null;
    for (const category of Object.values(categories)) {
      mediaFile = category.files.find(f => f.name === filename || path.basename(f.name, path.extname(f.name)) === filename);
      if (mediaFile) break;
    }
   
    if (!mediaFile) {
      return res.status(404).send('Media file not found');
    }
   
    // Check for subtitle file with the same name but .srt or .vtt extension
    const basePath = mediaFile.path.substring(0, mediaFile.path.lastIndexOf('.'));
    const srtPath = `${basePath}.srt`;
    const vttPath = `${basePath}.vtt`;
   
    // Check if VTT exists (preferred for web)
    if (fs.existsSync(vttPath)) {
      res.setHeader('Content-Type', 'text/vtt');
      return res.sendFile(vttPath);
    }
   
    // Check if SRT exists and convert it on-the-fly to VTT
    if (fs.existsSync(srtPath)) {
      // Read SRT file
      const srtContent = fs.readFileSync(srtPath, 'utf8');
     
      // Basic conversion from SRT to VTT format
      const vttContent = 'WEBVTT\n\n' + srtContent
        .replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2')  // Replace comma with dot in timestamps
        .replace(/\r\n/g, '\n');                         // Normalize line endings
     
      res.setHeader('Content-Type', 'text/vtt');
      return res.send(vttContent);
    }
   
    // No subtitle file found
    res.status(404).send('Subtitle file not found');
  } catch (error) {
    console.error('Error serving subtitle file:', error);
    res.status(500).send('Internal server error');
  }
});

// Image endpoint for direct image viewing
app.get('/images/:filename', authenticateToken, async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
   
    // Scan the media directory to find the file across all categories
    const categories = await scanDirectoryWithCategories(MEDIA_DIR);
    let file = null;
   
    for (const category of Object.values(categories)) {
      file = category.files.find(f => f.name === filename);
      if (file) break;
    }
   
    if (!file || file.type !== 'image') {
      return res.status(404).send('Image not found');
    }
   
    // Set appropriate content type based on file extension
    const ext = path.extname(file.path).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
   
    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.sendFile(file.path);
  } catch (error) {
    console.error('Error serving image file:', error);
    res.status(500).send('Internal server error');
  }
});

// Streaming endpoint
// Stream endpoint for direct video playback
app.get('/stream/:filename', authenticateToken, async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
   
    // Scan the media directory to find the file across all categories
    const categories = await scanDirectoryWithCategories(MEDIA_DIR);
    let file = null;
   
    for (const category of Object.values(categories)) {
      file = category.files.find(f => f.name === filename);
      if (file) break;
    }
   
    if (!file) {
      return res.status(404).send('File not found');
    }
   
    const filePath = file.path;
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
   
    // Handle range requests for video/audio streaming
    return rangeRequestHandler(req, res, filePath);
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


// Start server
app.listen(PORT, () => {
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

    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Access on your network at http://${localIP}:${PORT}`);
   
    // Run the initialization in a self-executing async function
    (async () => {
        try {
            // Initial scan of media directory with categories
            const categories = await scanDirectoryWithCategories(MEDIA_DIR);
            let totalFiles = 0;
           
            Object.values(categories).forEach(category => {
                totalFiles += category.files.length;
                console.log(`Found ${category.files.length} files in ${category.name}`);
            });
           
            console.log(`Total: ${totalFiles} media files across ${Object.keys(categories).length} categories`);
           
            // Flatten files for preprocessing
            const allFiles = [];
            Object.values(categories).forEach(category => {
                allFiles.push(...category.files);
            });
           
            // Start preprocessing in the background
            if (allFiles.length > 0) {
                preprocessMedia(allFiles).catch(err => {
                    console.error('Error in media preprocessing:', err);
                });
            }
        } catch (err) {
            console.error('Error during server initialization:', err);
        }
    })();
});