const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const fsSync = require('fs');

const supportedFormats = {
    video: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'],
    audio: ['.mp3', '.flac', '.wav', '.aac', '.ogg'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
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

module.exports = { scanDirectory, supportedFormats, preprocessMedia };