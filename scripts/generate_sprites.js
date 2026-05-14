const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const dbPath = path.join(__dirname, '../database/media.db');
const transcodedDir = path.join(__dirname, '../transcoded');

async function run() {
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at: ${dbPath}`);
    process.exit(1);
  }

  const db = new sqlite3.Database(dbPath);

  // Helper to run queries as promises
  const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  try {
    const files = await all('SELECT id, filepath, filename, category_id, duration FROM media_files');
    console.log(`Checking ${files.length} files for sprite generation...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mediaId = file.id;
      const duration = file.duration || 0;
      
      const mp4Path = path.join(transcodedDir, `${mediaId}.mp4`);
      const spritePath = path.join(transcodedDir, `${mediaId}_sprite.jpg`);
      const jsonPath = path.join(transcodedDir, `${mediaId}_sprite.json`);

      // Skip if source MP4 doesn't exist
      if (!fs.existsSync(mp4Path)) continue;

      // Skip if sprite already exists
      if (fs.existsSync(spritePath)) continue;

      if (duration <= 0) {
        console.warn(`Skipping ${file.filename}: Duration unknown.`);
        continue;
      }

      console.log(`[${i + 1}/${files.length}] Generating sprite for ${file.filename} (${duration}s)`);

      try {
        const interval = 10;
        const cols = 10;
        const totalFrames = Math.ceil(duration / interval);
        const rows = Math.ceil(totalFrames / cols);

        // Generate sprite sheet: 1 frame every 10 seconds, 160x90 per tile, dynamic grid
        const ffmpegCmd = `"${ffmpegPath}" -i "${mp4Path}" -vf "fps=1/${interval},scale=160:90,tile=${cols}x${rows}" -frames:v 1 "${spritePath}" -y`;
        execSync(ffmpegCmd, { stdio: 'ignore' });

        // Generate metadata
        const metadata = {
          interval,
          cols,
          rows,
          width: 160,
          height: 90
        };
        fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

      } catch (err) {
        console.error(`Failed to generate sprite for media ${mediaId}:`, err.message);
      }
    }

    console.log('Sprite generation process complete.');
  } catch (err) {
    console.error('Error processing library:', err);
  } finally {
    db.close();
  }
}

run();
