// server.js
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
const { scanDirectory, preprocessMedia } = require('./server/utils/fileScanner');

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

app.get('/api/media', authenticateToken, async (req, res) => {
  try {
    const mediaFiles = await scanDirectory(MEDIA_DIR);
    
    for(const file of mediaFiles) {
      if(file.type === 'video') {
        try{
          const thumbnailPath = await generateThumbnail(file.path, file.name);
          file.thumbnail = `/thumbnails/${path.basename(thumbnailPath)}`;
        } catch (err) {
          console.error(`Failed to generate thumbnail for ${file.name}:`, err);
          file.thumbnail = null;
        }
      } else if(file.type === 'audio') {
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

    res.json(mediaFiles);
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
    const mediaFiles = await scanDirectory(MEDIA_DIR);
    
    // Find the corresponding media file
    const mediaFile = mediaFiles.find(f => f.name === filename || path.basename(f.name, path.extname(f.name)) === filename);
    
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
    
    // Scan the media directory to find the file
    const mediaFiles = await scanDirectory(MEDIA_DIR);
    const file = mediaFiles.find(f => f.name === filename);
    
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
    
    // Scan the media directory to find the file
    const mediaFiles = await scanDirectory(MEDIA_DIR);
    const file = mediaFiles.find(f => f.name === filename);
    
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
            // Initial scan of media directory
            const mediaFiles = await scanDirectory(MEDIA_DIR);
            console.log(`Found ${mediaFiles.length} media files`);
            
            // Start preprocessing in the background
            preprocessMedia(mediaFiles).catch(err => {
                console.error('Error in media preprocessing:', err);
            });
        } catch (err) {
            console.error('Error during server initialization:', err);
        }
    })();
});