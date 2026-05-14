const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const fsSync = require('fs');
const db = require('../db');

const supportedFormats = {
    video: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'],
    audio: ['.mp3', '.flac', '.wav', '.aac', '.ogg'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
};

const categoryMapping = {
    'movies': 'Movies',
    'tv_shows': 'TV Shows',
    'images': 'Images',
    'audio': 'Audio'
};

const nicePrefix = process.platform === 'win32' ? '' : 'nice -n 19 ';

const ffprobePath = require('ffprobe-static').path;
const ffmpegPath = require('ffmpeg-static');

// Path normalization helpers for portability
// This ensures the DB stores relative paths so history is preserved if the project is moved
const MEDIA_DIR_ROOT = path.join(__dirname, '../../media');
const toRelative = (absPath) => {
    if (!absPath) return absPath;
    if (!path.isAbsolute(absPath)) return absPath;
    return path.relative(MEDIA_DIR_ROOT, absPath);
};

const toAbsolute = (relPath) => {
    if (!relPath) return relPath;
    if (path.isAbsolute(relPath)) return relPath;
    return path.join(MEDIA_DIR_ROOT, relPath);
};

const getDuration = (filePath) => {
    return new Promise((resolve) => {
        exec(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, (err, stdout) => {
            if (err) resolve(null);
            else resolve(Math.round(parseFloat(stdout)) || null);
        });
    });
};

const scanDirectory = async (dirPath) => {
    const files = [];
    const items = await fs.readdir(dirPath, {withFileTypes: true});

    for (const item of items) {
        if(item.isDirectory()) {
            files.push(...await scanDirectory(path.join(dirPath, item.name)));
        } else {
            const ext = path.extname(item.name).toLowerCase();
            let type = null;

            if(supportedFormats.video.includes(ext)) {
                type = 'video';
            } else if (supportedFormats.audio.includes(ext)) {
                type = 'audio';
            } else if (supportedFormats.image.includes(ext)) {
                type = 'image';
            }

            if(type) {
                const filePath = path.join(dirPath, item.name);
                const stat = await fs.stat(filePath);
                let duration = null;

                if (type === 'video' || type === 'audio') {
                    duration = await getDuration(filePath);
                }

                files.push({
                    name: item.name,
                    path: filePath,
                    type: type,
                    size: stat.size,
                    duration: duration
                });
            }
        }
    }

    return files;
};

// Enhanced function to scan TV shows with better series detection
const scanTvShowsDirectory = async (tvShowsPath) => {
    const series = {};
    
    try {
        const items = await fs.readdir(tvShowsPath, {withFileTypes: true});
        
        for (const item of items) {
            if (item.isDirectory()) {
                // Each directory is likely a TV series
                const seriesName = item.name;
                const seriesPath = path.join(tvShowsPath, item.name);
                const episodes = await scanDirectory(seriesPath);
                
                if (episodes.length > 0) {
                    series[seriesName] = {
                        name: seriesName,
                        path: seriesPath,
                        episodes: episodes.map(ep => ({
                            ...ep,
                            seriesName: seriesName
                        })),
                        type: 'tv_series'
                    };
                }
            } else {
                // Files directly in TV shows folder - try to group by series name
                const ext = path.extname(item.name).toLowerCase();
                if (supportedFormats.video.includes(ext)) {
                    const seriesName = extractSeriesNameFromFile(item.name);
                    const filePath = path.join(tvShowsPath, item.name);
                    const fileStat = await fs.stat(filePath);
                    
                    if (!series[seriesName]) {
                        series[seriesName] = {
                            name: seriesName,
                            path: tvShowsPath,
                            episodes: [],
                            type: 'tv_series'
                        };
                    }
                    
                    series[seriesName].episodes.push({
                        name: item.name,
                        path: filePath,
                        type: 'video',
                        size: fileStat.size,
                        seriesName: seriesName
                    });
                }
            }
        }
        
        // Sort episodes within each series
        Object.values(series).forEach(s => {
            s.episodes.sort((a, b) => {
                // Try to sort by episode number if possible
                const aMatch = a.name.match(/S(\d+)E(\d+)/i) || a.name.match(/(\d+)x(\d+)/i);
                const bMatch = b.name.match(/S(\d+)E(\d+)/i) || b.name.match(/(\d+)x(\d+)/i);
                
                if (aMatch && bMatch) {
                    const aSeason = parseInt(aMatch[1]);
                    const aEpisode = parseInt(aMatch[2]);
                    const bSeason = parseInt(bMatch[1]);
                    const bEpisode = parseInt(bMatch[2]);
                    
                    if (aSeason !== bSeason) {
                        return aSeason - bSeason;
                    }
                    return aEpisode - bEpisode;
                }
                
                // Fallback to alphabetical sorting
                return a.name.localeCompare(b.name);
            });
        });
        
    } catch (error) {
        console.error('Error scanning TV shows directory:', error);
    }
    
    return series;
};

// Function to extract series name from filename
const extractSeriesNameFromFile = (filename) => {
    // Remove file extension
    const nameWithoutExt = path.parse(filename).name;
    
    // Try various patterns to extract series name
    const patterns = [
        /^(.+?)\s+S\d+E\d+/i,          // "Series Name S01E01"
        /^(.+?)\s+Season\s+\d+/i,       // "Series Name Season 1"
        /^(.+?)\s+\d+x\d+/i,           // "Series Name 1x01"
        /^(.+?)\s+-\s+S\d+E\d+/i,      // "Series Name - S01E01"
        /^(.+?)\s+\[\d+x\d+\]/i,       // "Series Name [1x01]"
        /^(.+?)\s+\(\d{4}\)/i,         // "Series Name (2023)"
    ];
    
    for (const pattern of patterns) {
        const match = nameWithoutExt.match(pattern);
        if (match) {
            return match[1].trim();
        }
    }
    
    // Fallback: use everything before first number sequence or special character
    const fallbackMatch = nameWithoutExt.match(/^(.+?)(?:\s+\d+|\s+S\d+|\s+-|\s+\[|\s+\()/i);
    if (fallbackMatch) {
        return fallbackMatch[1].trim();
    }
    
    // Last resort: use the first few words
    const words = nameWithoutExt.split(/[\s\-\.\_]+/);
    return words.slice(0, Math.min(3, words.length)).join(' ');
};

// Updated function to scan directories and organize by categories
const scanDirectoryWithCategories = async (dirPath) => {
    const categories = {};
   
    try {
        const items = await fs.readdir(dirPath, {withFileTypes: true});
       
        for (const item of items) {
            if (item.isDirectory()) {
                const categoryKey = item.name.toLowerCase();
               
                // Only process known category directories
                if (categoryMapping[categoryKey]) {
                    const categoryPath = path.join(dirPath, item.name);
                    
                    if (categoryKey === 'tv_shows') {
                        // Special handling for TV shows
                        const tvSeries = await scanTvShowsDirectory(categoryPath);
                        const tvFiles = [];
                        
                        // Convert series object to flat array for compatibility
                        Object.values(tvSeries).forEach(series => {
                            // Add series info to each episode
                            series.episodes.forEach(episode => {
                                episode.category = categoryKey;
                                episode.categoryDisplay = categoryMapping[categoryKey];
                                episode.seriesName = series.name;
                            });
                            tvFiles.push(...series.episodes);
                        });
                        
                        categories[categoryKey] = {
                            name: categoryMapping[categoryKey],
                            files: tvFiles,
                            series: tvSeries // Keep series structure for frontend
                        };
                    } else {
                        // Regular scanning for other categories
                        const files = await scanDirectory(categoryPath);
                        
                        const filesWithCategory = files.map(file => ({
                            ...file,
                            category: categoryKey,
                            categoryDisplay: categoryMapping[categoryKey]
                        }));
                        
                        categories[categoryKey] = {
                            name: categoryMapping[categoryKey],
                            files: filesWithCategory
                        };
                    }
                }
            }
        }
       
        // Return categories in the desired order
        const orderedCategories = {};
        const order = ['movies', 'tv_shows', 'images', 'audio'];
       
        order.forEach(key => {
            if (categories[key]) {
                orderedCategories[key] = categories[key];
            }
        });
       
        return orderedCategories;
    } catch (error) {
        console.error('Error scanning directory with categories:', error);
        return {};
    }
};

// Function to get TV series details by name
const getTvSeriesDetails = async (mediaDir, seriesName) => {
    try {
        const tvShowsPath = path.join(mediaDir, 'tv_shows');
        const series = await scanTvShowsDirectory(tvShowsPath);
        
        // Find series by name (case insensitive)
        const foundSeries = Object.values(series).find(s => 
            s.name.toLowerCase() === seriesName.toLowerCase()
        );
        
        return foundSeries || null;
    } catch (error) {
        console.error('Error getting TV series details:', error);
        return null;
    }
};

const TranscodeManager = require('../services/transcodeManager');

// New function to preprocess media files for caching
const preprocessMedia = async (files) => {
    const transcodedDir = path.join(__dirname, '../../transcoded');
    const adaptiveDir = path.join(__dirname, '../../adaptive');
   
    // Create directories if they don't exist
    if (!fsSync.existsSync(transcodedDir)) {
        await fs.mkdir(transcodedDir, { recursive: true });
    }
   
    if (!fsSync.existsSync(adaptiveDir)) {
        await fs.mkdir(adaptiveDir, { recursive: true });
    }
   
    console.log(`Starting background preprocessing of ${files.length} files...`);
   
    // Process video files
    for (const file of files) {
        if (file.type === 'audio') {
            const ext = path.extname(file.path).toLowerCase();
            const baseName = path.basename(file.path, ext);
            const coverArtDir = path.join(__dirname, '../../covers');
           
            // Create directory if it doesn't exist
            if (!fsSync.existsSync(coverArtDir)) {
                await fs.mkdir(coverArtDir, { recursive: true });
            }
           
            const coverPath = path.join(coverArtDir, `${baseName}.jpg`);
           
            // Only extract cover art if not already done
            if (!fsSync.existsSync(coverPath)) {
                console.log(`Extracting cover art for: ${file.name}`);
                exec(`${nicePrefix}"${ffmpegPath}" -i "${toAbsolute(file.path)}" -an -vcodec copy "${coverPath}"`,
                    (error) => {
                        // Ignore errors as not all audio files have embedded artwork
                        if (!error) {
                            console.log(`Cover art extracted for: ${file.name}`);
                        }
                    }
                );
            }
        }
        else if (file.type === 'video') {
            const ext = path.extname(file.path).toLowerCase();
            
            // Skip already supported formats for direct transcoding
            if (['.mp4', '.webm', '.mov'].includes(ext)) {
                continue;
            }
           
            // Use TranscodeManager for MKV/AVI/etc
            if (['.mkv', '.avi', '.wmv', '.flv'].includes(ext)) {
                // We need the mediaId here, which we might not have yet during initial scan
                // So we'll fetch it from DB after sync is done
                continue;
            }
        }
    }
};

// Function to trigger background transcoding for all files that need it
const triggerBackgroundTranscoding = async () => {
    try {
        const files = await db.all(`
            SELECT mf.id, mf.filepath, mf.filename 
            FROM media_files mf
            JOIN categories c ON mf.category_id = c.id
            WHERE c.key_name IN ('movies', 'tv_shows')
            AND (filepath LIKE '%.mkv' OR filepath LIKE '%.avi' OR filepath LIKE '%.wmv' OR filepath LIKE '%.flv')
        `);

        for (const file of files) {
            await TranscodeManager.addToQueue(file.id, toAbsolute(file.filepath));
        }
    } catch (error) {
        console.error('Error triggering background transcoding:', error);
    }
};

// New function to synchronize scanned files with the SQLite database
const syncMediaWithDatabase = async (mediaDir) => {
    // First, scan everything using the existing logic
    const scannedCategories = await scanDirectoryWithCategories(mediaDir);
    
    // Normalize path helper for database storage
    const normalizePathForDb = (p) => toRelative(p).toLowerCase();
    
    // Get category mappings from DB
    const dbCategoriesArray = await db.all('SELECT * FROM categories');
    const dbCategories = {};
    dbCategoriesArray.forEach(cat => {
        dbCategories[cat.key_name] = cat.id;
    });

    let newFilesCount = 0;

    // Process each category
    for (const [catKey, catData] of Object.entries(scannedCategories)) {
        const categoryId = dbCategories[catKey];
        if (!categoryId) continue;

        if (catKey === 'tv_shows' && catData.series) {
            // Process TV Shows
            for (const [seriesName, seriesData] of Object.entries(catData.series)) {
                // Upsert Series
                let seriesRecord = await db.get('SELECT id FROM series WHERE name = ?', [seriesName]);
                if (!seriesRecord) {
                    const result = await db.run('INSERT INTO series (name) VALUES (?)', [seriesName]);
                    seriesRecord = { id: result.id };
                }
                const seriesId = seriesRecord.id;

                // Process Episodes
                for (const episode of seriesData.episodes) {
                    const normPath = normalizePathForDb(episode.path);
                    const existing = await db.get('SELECT id FROM media_files WHERE LOWER(filepath) = ?', [normPath]);
                    if (!existing) {
                        // Extract season/episode numbers if possible
                        let sNum = null, eNum = null;
                        const filenameMatch = episode.name.match(/S(\d+)E(\d+)/i) || episode.name.match(/(\d+)x(\d+)/i);
                        if (filenameMatch) {
                            sNum = parseInt(filenameMatch[1]);
                            eNum = parseInt(filenameMatch[2]);
                        } else {
                            // Check parent directory for Season number
                            const parentDir = path.basename(path.dirname(episode.path));
                            const seasonMatch = parentDir.match(/(?:Season|S)\s*(\d+)/i);
                            if (seasonMatch) {
                                sNum = parseInt(seasonMatch[1]);
                            } else {
                                sNum = 1; // Default to season 1 if we can't find one
                            }
                            
                            // Check filename for episode number as fallback
                            const epMatch = episode.name.match(/(?:Episode|Ep|E|\b)(\d+)\b/i);
                            if (epMatch) {
                                eNum = parseInt(epMatch[1]);
                            }
                        }
                        
                        await db.run(
                            `INSERT INTO media_files 
                            (category_id, series_id, filename, filepath, media_type, file_size, duration, episode_num, season_num) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [categoryId, seriesId, episode.name, toRelative(episode.path), episode.type, episode.size, episode.duration, eNum, sNum]
                        );
                        newFilesCount++;
                    }
                }
            }
        } else {
            // Process other categories (movies, audio, images)
            for (const file of catData.files) {
                const normPath = normalizePathForDb(file.path);
                const existing = await db.get('SELECT id FROM media_files WHERE LOWER(filepath) = ?', [normPath]);
                if (!existing) {
                    await db.run(
                        `INSERT INTO media_files 
                        (category_id, filename, filepath, media_type, file_size, duration) 
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [categoryId, file.name, toRelative(file.path), file.type, file.size, file.duration]
                    );
                    newFilesCount++;
                }
            }
        }
    }
    
    // --- START CLEANUP PHASE ---
    console.log('Cleaning up stale database records...');
    const allDbFiles = await db.all('SELECT id, filepath FROM media_files');
    let removedCount = 0;
    
    for (const dbFile of allDbFiles) {
        const absPath = toAbsolute(dbFile.filepath);
        if (!fsSync.existsSync(absPath)) {
            await db.run('DELETE FROM media_files WHERE id = ?', [dbFile.id]);
            // Also clean up watch history for this file
            await db.run('DELETE FROM watch_history WHERE media_id = ?', [dbFile.id]);
            removedCount++;
        }
    }
    // --- END CLEANUP PHASE ---
    
    console.log(`Database sync complete. Added ${newFilesCount} new files, removed ${removedCount} stale entries.`);
    
    // Trigger background transcoding after sync
    triggerBackgroundTranscoding();

    return scannedCategories;
};

module.exports = { 
    scanDirectory, 
    scanDirectoryWithCategories, 
    scanTvShowsDirectory,
    getTvSeriesDetails,
    extractSeriesNameFromFile,
    supportedFormats, 
    preprocessMedia,
    triggerBackgroundTranscoding,
    syncMediaWithDatabase
};