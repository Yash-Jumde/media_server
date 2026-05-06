const path = require('path');
const fs = require('fs');

const MEDIA_DIR = path.join(__dirname, '../../media');

// Helper to resolve relative path from DB to absolute path
function resolveMediaRoot(relativePath) {
  if (!relativePath) return relativePath;
  if (path.isAbsolute(relativePath)) return relativePath;
  return path.join(MEDIA_DIR, relativePath);
}

// Helper to format media file objects consistently for the frontend
function formatMediaFile(row, overrideCategoryKey = null, overrideCategoryName = null) {
  const absPath = resolveMediaRoot(row.filepath);
  let thumbnailPath = null;
  if (row.media_type === 'video') {
    thumbnailPath = row.thumbnail_path || `/thumbnails/${path.basename(absPath, path.extname(absPath))}.jpg`;
  } else if (row.media_type === 'audio') {
    const anticipatedPath = path.join(__dirname, '../../covers', `${path.basename(absPath, path.extname(absPath))}.jpg`);
    if (fs.existsSync(anticipatedPath)) {
      thumbnailPath = `/covers/${path.basename(absPath, path.extname(absPath))}.jpg`;
    }
  } else if (row.media_type === 'image') {
    thumbnailPath = `/images/${row.id}`;
  }

  return {
    id: row.id,
    name: row.title || row.filename,
    path: absPath,
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
    duration: row.duration,
    series_id: row.series_id,
    series_name: row.series_name,
    season_num: row.season_num,
    episode_num: row.episode_num
  };
}

let cachedHWEncoder = null;

/**
 * Detects available hardware encoders (NVENC, QSV, etc.)
 * and verifies they actually work by running a short test.
 */
function getHWEncoder() {
  if (cachedHWEncoder !== null) return cachedHWEncoder;

  const { execSync } = require('child_process');
  const ffmpeg = require('ffmpeg-static');
  
  let availableEncoders = [];
  try {
    const encoders = execSync(`"${ffmpeg}" -encoders`).toString();
    if (encoders.includes('h264_nvenc')) availableEncoders.push('h264_nvenc');
    if (encoders.includes('h264_qsv')) availableEncoders.push('h264_qsv');
    if (encoders.includes('h264_vaapi')) availableEncoders.push('h264_vaapi');
  } catch (e) {
    console.error('[HWEncoder] Failed to list encoders:', e.message);
  }

  // Test each available hardware encoder
  for (const encoder of availableEncoders) {
    try {
      console.log(`[HWEncoder] Testing ${encoder}...`);
      // Run a 1-second transcode of a null source to test if the encoder initializes
      // Using 1280x720 because some HW encoders (like NVENC) fail on very small dimensions
      execSync(`"${ffmpeg}" -f lavfi -i color=c=black:s=1280x720:d=1 -c:v ${encoder} -f null -`, { stdio: 'ignore', timeout: 5000 });
      console.log(`[HWEncoder] ${encoder} is functional.`);
      cachedHWEncoder = encoder;
      return cachedHWEncoder;
    } catch (e) {
      console.warn(`[HWEncoder] ${encoder} failed test: ${e.message}. Falling back.`);
    }
  }

  console.log('[HWEncoder] Using software encoder (libx264).');
  cachedHWEncoder = 'libx264';
  return cachedHWEncoder;
}

module.exports = {
  resolveMediaRoot,
  formatMediaFile,
  getHWEncoder
};
