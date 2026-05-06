const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const rangeRequestHandler = require('../middleware/rangeRequest');
const { resolveMediaRoot } = require('../utils/helpers');
const TranscodeManager = require('../services/transcodeManager');

// --- TRANSCODE PROGRESS TRACKING ---
const transcodeProgress = new Map();

/**
 * ensureRemuxed: Handles MKV -> MP4 caching.
 * Only runs when explicitly requested via /stream/:id or on-demand.
 */
async function ensureRemuxed(filePath, mediaId) {
  // Use TranscodeManager instead of local implementation
  return TranscodeManager.addToQueue(mediaId, filePath);
}

/**
 * ensureHLS: Generates HLS segments for smooth mobile/iPad playback.
 */
async function ensureHLS(filePath, mediaId) {
  const adaptiveDir = path.join(__dirname, '../../adaptive');
  const hlsDir = path.join(adaptiveDir, String(mediaId));
  if (!fs.existsSync(hlsDir)) fs.mkdirSync(hlsDir, { recursive: true });

  const playlistPath = path.join(hlsDir, 'playlist.m3u8');
  const lockPath = path.join(hlsDir, 'hls.lock');

  if (fs.existsSync(playlistPath) && fs.statSync(playlistPath).size > 0 && !fs.existsSync(lockPath)) {
    return playlistPath;
  }

  if (fs.existsSync(lockPath)) throw new Error('HLS in progress');

  const ffmpeg = require('fluent-ffmpeg');
  const ffmpegStatic = require('ffmpeg-static');
  ffmpeg.setFfmpegPath(ffmpegStatic);

  const { getHWEncoder } = require('../utils/helpers');
  const hwEncoder = getHWEncoder();

  console.log(`[HLS] Background Gen: ${mediaId} using ${hwEncoder}`);
  fs.writeFileSync(lockPath, new Date().toISOString());

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions([
        `-c:v ${hwEncoder}`,
        '-pix_fmt yuv420p',
        '-c:a aac', '-b:a 128k', '-ac 2',
        '-f hls', '-hls_time 6', '-hls_list_size 0',
        '-hls_playlist_type event',
        '-hls_flags independent_segments',
        '-force_key_frames expr:gte(t,n_forced*6)',
        `-hls_segment_filename ${path.join(hlsDir, 'segment%03d.ts')}`
      ])
      .output(playlistPath)
      .on('end', () => {
        try { fs.unlinkSync(lockPath); } catch(e) {}
        resolve(playlistPath);
      })
      .on('error', (err) => {
        try { fs.unlinkSync(lockPath); } catch(e) {}
        reject(err);
      })
      .run();
  });
}

// Stream Mode Discovery
router.get('/api/stream-mode/:id', authenticateToken, async (req, res) => {
  try {
    const mediaId = req.params.id;
    const file = await db.get('SELECT filepath, media_type FROM media_files WHERE id = ?', [mediaId]);
    if (!file) return res.status(404).json({ mode: 'unknown' });

    const filePath = resolveMediaRoot(file.filepath);
    const ext = path.extname(filePath).toLowerCase();
    
    // Check if it's cached in TranscodeManager or on disk
    const isTranscoding = TranscodeManager.isTranscoding(mediaId);
    const transcodePercent = TranscodeManager.getProgress(mediaId);
    
    const cachedPath = path.join(__dirname, '../../transcoded', `${mediaId}.mp4`);
    const isCached = fs.existsSync(cachedPath) && 
                     fs.statSync(cachedPath).size > 0 && 
                     !fs.existsSync(path.join(__dirname, '../../transcoded', `${mediaId}.lock`));

    const isNative = ['.mp4', '.mov', '.mp3'].includes(ext);

    // Proactively trigger transcoding if it's an unsupported format and not already cached or in queue
    if (['.mkv', '.avi', '.wmv', '.flv'].includes(ext) && !isCached && !isTranscoding) {
      console.log(`[StreamMode] Proactively adding ${mediaId} to transcode queue`);
      TranscodeManager.addToQueue(mediaId, filePath);
    }

    // Check HLS
    const hlsPlaylist = path.join(__dirname, '../../adaptive', String(mediaId), 'playlist.m3u8');
    const hlsExists = fs.existsSync(hlsPlaylist);

    res.json({
      mode: isCached ? 'cached' : (isNative ? 'native' : 'live'),
      isTranscoding,
      transcodePercent,
      hlsExists,
      hlsUrl: hlsExists ? `/hls/${mediaId}/playlist.m3u8` : null,
    });
  } catch (err) {
    res.status(500).json({ mode: 'unknown' });
  }
});

// HLS Routes
router.get('/hls/:id/playlist.m3u8', authenticateToken, async (req, res) => {
  const playlistPath = path.join(__dirname, '../../adaptive', String(req.params.id), 'playlist.m3u8');
  if (!fs.existsSync(playlistPath)) return res.status(404).send('Not found');
  
  const token = req.query.token || req.headers['authorization']?.split(' ')[1];
  let content = fs.readFileSync(playlistPath, 'utf8');
  if (token) content = content.replace(/(segment\d+\.ts)/g, `$1?token=${token}`);
  
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.send(content);
});

router.get('/hls/:id/:segment', authenticateToken, async (req, res) => {
  const segmentPath = path.join(__dirname, '../../adaptive', String(req.params.id), req.params.segment);
  if (fs.existsSync(segmentPath)) {
    res.setHeader('Content-Type', 'video/MP2T');
    return res.sendFile(segmentPath);
  }
  res.status(404).send('Not found');
});

// Main Stream Route
router.get('/stream/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const startTime = parseFloat(req.query.startTime) || 0;
    const file = await db.get('SELECT filepath FROM media_files WHERE id = ?', [id]);
    if (!file) return res.status(404).send('Not found');

    const filePath = resolveMediaRoot(file.filepath);
    const ext = path.extname(filePath).toLowerCase();

    // If it's a non-native format, check cache or live transcode
    if (['.mkv', '.avi', '.wmv', '.flv'].includes(ext)) {
      const cachedPath = path.join(__dirname, '../../transcoded', `${id}.mp4`);
      const isCached = fs.existsSync(cachedPath) && 
                       fs.statSync(cachedPath).size > 0 && 
                       !fs.existsSync(path.join(__dirname, '../../transcoded', `${id}.lock`));

      if (isCached) {
        return rangeRequestHandler(req, res, cachedPath);
      }

      // No cache available - Perform Live Transcode
      const ffmpeg = require('fluent-ffmpeg');
      const ffmpegStatic = require('ffmpeg-static');
      const { getHWEncoder } = require('../utils/helpers');
      
      ffmpeg.setFfmpegPath(ffmpegStatic);
      const hwEncoder = getHWEncoder();

      console.log(`[Stream] Live Transcode: ${path.basename(filePath)} at ${startTime}s using ${hwEncoder}`);

      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'none',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      const command = ffmpeg(filePath)
        .seekInput(startTime)
        .outputOptions([
          '-f mp4',
          '-movflags frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset',
          '-frag_duration 1000000',
          '-copyts',
          `-c:v ${hwEncoder}`,
          '-preset ultrafast',
          '-tune zerolatency',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-c:a aac', '-ac 2',
          '-map 0:v:0',
          '-map 0:a:0?',
          '-threads 0'
        ])
        .on('error', (err) => {
          if (err.message.includes('SIGKILL') || err.message.includes('ffmpeg was killed')) return;
          console.error('[FFmpeg] Live transcode error:', err.message);
          if (!res.headersSent) res.status(500).send(err.message);
        });

      command.pipe(res, { end: true });

      req.on('close', () => {
        command.kill('SIGKILL');
      });

      return;
    }

    return rangeRequestHandler(req, res, filePath);
  } catch (error) {
    console.error('[Stream] Error:', error);
    res.status(500).send('Server error');
  }
});

module.exports = { router, ensureRemuxed, ensureHLS, transcodeProgress };