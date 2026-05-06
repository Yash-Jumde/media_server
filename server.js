console.log(`\n--- Server Process Starting: ${new Date().toISOString()} ---`);
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { authenticateToken } = require('./server/middleware/auth');
const rangeRequestHandler = require('./server/middleware/rangeRequest');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { syncMediaWithDatabase } = require('./server/utils/fileScanner');
const db = require('./server/db');
const FileWatcher = require('./server/services/fileWatcher');
const TMDBScraper = require('./server/services/tmdbScraper');

// --- Log Redirection to File ---
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const serverLogStream = fs.createWriteStream(path.join(logDir, 'server.log'), { flags: 'a' });

const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

process.stdout.write = (chunk, encoding, callback) => {
  serverLogStream.write(chunk, encoding);
  return originalStdout(chunk, encoding, callback);
};

process.stderr.write = (chunk, encoding, callback) => {
  serverLogStream.write(chunk, encoding);
  return originalStderr(chunk, encoding, callback);
};

console.log(`\n--- Server Session Started: ${new Date().toISOString()} ---\n`);

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

require('dotenv').config();

const tmdb = new TMDBScraper(process.env.TMDB_API_KEY);

const app = express();
const PORT = process.env.PORT || 5000;
const MEDIA_DIR = path.join(__dirname, 'media');

app.use(cors({ origin: true, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" }, crossOriginEmbedderPolicy: false }));
app.use(compression({ filter: (req, res) => { if (req.path.startsWith('/stream')) return false; return compression.filter(req, res); } }));
app.use(morgan('dev'));
app.use(express.json());

const { resolveMediaRoot } = require('./server/utils/helpers');
const { router: streamRouter } = require('./server/routes/stream');
const mediaRouter = require('./server/routes/media');
const tvShowsRouter = require('./server/routes/tvshows');
const libraryRouter = require('./server/routes/library');
const favoritesRouter = require('./server/routes/favorites');
const progressRouter = require('./server/routes/progress');
const subtitlesRouter = require('./server/routes/subtitles');
const imagesRouter = require('./server/routes/images');

app.use((req, res, next) => { req.tmdb = tmdb; next(); });
app.get('/', (req, res) => { res.redirect('http://' + req.hostname + ':3000'); });

const authRoutes = require('./server/routes/auth');
const adminRoutes = require('./server/routes/admin');
const userRoutes = require('./server/routes/user');

app.use('/api', authRoutes);
app.use('/api', adminRoutes);
app.use('/api', userRoutes);
app.use('/covers', express.static(path.join(__dirname, 'covers')));
app.use('/api', mediaRouter);
app.use('/api', tvShowsRouter);
app.use('/api', libraryRouter);
app.use('/api', favoritesRouter);
app.use('/api', progressRouter);
app.use('/', streamRouter);
app.use('/', subtitlesRouter);
app.use('/', imagesRouter);

const server = app.listen(PORT, () => {
  server.timeout = 0;
  console.log(`\n🚀 Media Server is running on port ${PORT}!`);

  (async () => {
    try {
      console.log('[Server] Initializing database...');
      await db.initializeDatabase();
      
      console.log('[Server] Starting FileWatcher...');
      const watcher = new FileWatcher(MEDIA_DIR);
      watcher.start();
      
      console.log('Starting initial library scan...');
      await syncMediaWithDatabase(MEDIA_DIR);

      // Clean up stale lock files
      const transcodedDir = path.join(__dirname, 'transcoded');
      if (fs.existsSync(transcodedDir)) {
        fs.readdirSync(transcodedDir).filter(f => f.endsWith('.lock')).forEach(f => {
          try { fs.unlinkSync(path.join(transcodedDir, f)); } catch(e) {}
        });
      }

      console.log('Server initialized. Ready for playback.');
      if (tmdb.enabled) tmdb.scrapeAll().catch(err => console.error('[TMDB] Startup scrape error:', err));
    } catch (err) {
      console.error('Error during server initialization:', err);
    }
  })();
});