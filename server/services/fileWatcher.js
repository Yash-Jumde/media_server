const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
const db = require('../db');
const { supportedFormats, extractSeriesNameFromFile } = require('../utils/fileScanner');

class FileWatcher {
    constructor(mediaDir) {
        this.mediaDir = mediaDir;
        this.watcher = null;
        this.isReady = false;
    }

    start() {
        console.log(`[FileWatcher] Starting watcher on: ${this.mediaDir}`);

        this.watcher = chokidar.watch(this.mediaDir, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        this.watcher
            .on('ready', () => {
                this.isReady = true;
                console.log('[FileWatcher] Initial scan complete. Watching for changes...');
            })
            .on('add', (filePath) => this.handleFileAdded(filePath))
            .on('unlink', (filePath) => this.handleFileRemoved(filePath))
            .on('error', (error) => console.error('[FileWatcher] Error:', error));

        return this;
    }

    async handleFileAdded(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        let mediaType = null;

        if (supportedFormats.video.includes(ext)) mediaType = 'video';
        else if (supportedFormats.audio.includes(ext)) mediaType = 'audio';
        else if (supportedFormats.image.includes(ext)) mediaType = 'image';

        if (!mediaType) return;

        console.log(`[FileWatcher] New file detected: ${path.basename(filePath)}`);

        try {
            const existing = await db.get('SELECT id FROM media_files WHERE filepath = ?', [filePath]);
            if (existing) return;

            const stat = await fs.stat(filePath);
            const filename = path.basename(filePath);
            const category = this.detectCategory(filePath);
            
            if (!category) return;

            const catRow = await db.get('SELECT id FROM categories WHERE key_name = ?', [category]);
            if (!catRow) return;

            let seriesId = null;
            let seasonNum = null;
            let episodeNum = null;

            if (category === 'tv_shows') {
                const seriesName = this.detectSeriesName(filePath);
                if (seriesName) {
                    let seriesRow = await db.get('SELECT id FROM series WHERE name = ?', [seriesName]);
                    if (!seriesRow) {
                        const result = await db.run('INSERT INTO series (name) VALUES (?)', [seriesName]);
                        seriesRow = { id: result.id };
                    }
                    seriesId = seriesRow.id;

                    const match = filename.match(/S(\d+)E(\d+)/i) || filename.match(/(\d+)x(\d+)/i);
                    if (match) {
                        seasonNum = parseInt(match[1]);
                        episodeNum = parseInt(match[2]);
                    }
                }
            }

            await db.run(
                `INSERT INTO media_files 
                (category_id, series_id, filename, filepath, media_type, file_size, episode_num, season_num) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [catRow.id, seriesId, filename, filePath, mediaType, stat.size, episodeNum, seasonNum]
            );

            console.log(`[FileWatcher] Added to database: ${filename}`);
        } catch (error) {
            console.error(`[FileWatcher] Error adding file: ${error.message}`);
        }
    }

    async handleFileRemoved(filePath) {
        try {
            const result = await db.run('DELETE FROM media_files WHERE filepath = ?', [filePath]);
            if (result.changes > 0) {
                console.log(`[FileWatcher] Removed from database: ${path.basename(filePath)}`);
            }
        } catch (error) {
            console.error(`[FileWatcher] Error removing file: ${error.message}`);
        }
    }

    detectCategory(filePath) {
        const relative = path.relative(this.mediaDir, filePath).toLowerCase();
        const parts = relative.split(path.sep);
        
        if (parts.length === 0) return null;

        const topDir = parts[0];
        const validCategories = ['movies', 'tv_shows', 'images', 'audio'];
        return validCategories.includes(topDir) ? topDir : null;
    }

    detectSeriesName(filePath) {
        const relative = path.relative(this.mediaDir, filePath);
        const parts = relative.split(path.sep);
        
        // If file is in media/tv_shows/SeriesName/file.mp4
        if (parts.length >= 3) {
            return parts[1]; // The directory name IS the series name
        }

        // Fallback: extract from filename
        return extractSeriesNameFromFile(path.basename(filePath));
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
            console.log('[FileWatcher] Stopped.');
        }
    }
}

module.exports = FileWatcher;
