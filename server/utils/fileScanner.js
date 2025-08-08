const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const fsSync = require('fs');

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
                files.push({
                    name: item.name,
                    path: path.join(dirPath, item.name),
                    type: type,
                    size: (await fs.stat(path.join(dirPath, item.name))).size
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
                exec(`nice -n 19 ffmpeg -i "${file.path}" -an -vcodec copy "${coverPath}"`,
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
            const baseName = path.basename(file.path, ext);
           
            // Skip already supported formats for direct transcoding
            if (['.mp4', '.webm'].includes(ext)) {
                continue;
            }
           
            const transcodedPath = path.join(transcodedDir, `${baseName}.mp4`);
            const adaptivePath = path.join(adaptiveDir, baseName);
           
            // Create folder for adaptive streaming files
            if (!fsSync.existsSync(adaptivePath)) {
                await fs.mkdir(adaptivePath, { recursive: true });
            }
           
            // Only transcode if not already done
            if (!fsSync.existsSync(transcodedPath)) {
                console.log(`Background transcoding: ${file.name}`);
                // Use a lower-priority subprocess for MP4 version
                exec(`nice -n 19 ffmpeg -i "${file.path}" -c:v libx264 -preset medium -crf 22 -c:a aac -b:a 128k "${transcodedPath}"`,
                    (error) => {
                        if (error) {
                            console.error(`Error transcoding ${file.name}:`, error);
                        } else {
                            console.log(`Completed transcoding: ${file.name}`);
                        }
                    }
                );
            }
           
            // Check if adaptive streaming files exist
            const hlsPlaylist = path.join(adaptivePath, 'playlist.m3u8');
            if (!fsSync.existsSync(hlsPlaylist)) {
                console.log(`Creating adaptive streaming files for: ${file.name}`);
                exec(`nice -n 19 ffmpeg -i "${file.path}" -c:v libx264 -crf 22 -c:a aac -b:a 128k -f hls -hls_time 10 -hls_list_size 0 -hls_segment_filename "${adaptivePath}/segment%03d.ts" "${hlsPlaylist}"`,
                    (error) => {
                        if (error) {
                            console.error(`Error creating HLS for ${file.name}:`, error);
                        } else {
                            console.log(`Completed HLS creation: ${file.name}`);
                        }
                    }
                );
            }
        }
    }
   
    console.log("Background preprocessing initiated. This will continue in the background.");
};

module.exports = { 
    scanDirectory, 
    scanDirectoryWithCategories, 
    scanTvShowsDirectory,
    getTvSeriesDetails,
    extractSeriesNameFromFile,
    supportedFormats, 
    preprocessMedia 
};