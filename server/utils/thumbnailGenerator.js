const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const { exec } = require('child_process');

const THUMBNAIL_DIR = path.join(__dirname, '../../thumbnails');

if(!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, {recursive: true});
}

const generateThumbnail = (videoPath, videoName) => {
    return new Promise((resolve, reject) => {
        const thumbnailName = path.parse(videoName).name;
        const thumbnailPath = path.join(THUMBNAIL_DIR, `${thumbnailName}.jpg`);

        if(fs.existsSync(thumbnailPath)) {
            return resolve(thumbnailPath);
        }

        const command = `"${ffmpegPath}" -ss 00:00:59 -i "${videoPath}" -vframes 1 -vf "scale=200:-1" -q:v 2 "${thumbnailPath}"`;
        
        exec(command, (error) => {
            if(error) {
                console.error(`Error generating thumbnail: ${error}`);
                return reject(error);
            }
            resolve(thumbnailPath);
        });
    });
};

const transcodeVideo = (inputPath, outputPath, format = 'mp4') => {
    return new Promise((resolve, reject) => {
        const ffmpeg = require('fluent-ffmpeg');
        ffmpeg(inputPath)
            .outputFormat(format)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
};


const createHLSStream = async (inputPath, outputDir) => {
    return new Promise((resolve, reject) => {
        const ffmpeg = require('fluent-ffmpeg');
        const basename = path.basename(inputPath, path.extname(inputPath));
        const outputPath = path.join(outputDir, basename);
        
        // Create output directory
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        
        ffmpeg(inputPath)
            .outputOptions([
                '-profile:v baseline',
                '-level 3.0',
                '-start_number 0',
                '-hls_time 10',      // 10-second segments
                '-hls_list_size 0',  // Keep all segments
                '-f hls'             // HLS format
            ])
            .output(path.join(outputPath, 'playlist.m3u8'))
            .on('end', () => {
                console.log(`HLS conversion complete for ${basename}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`Error creating HLS stream: ${err.message}`);
                reject(err);
            })
            .run();
    });
};

module.exports = {generateThumbnail, transcodeVideo, createHLSStream};