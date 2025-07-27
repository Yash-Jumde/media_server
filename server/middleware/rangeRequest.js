const fs = require('fs');
const path = require('path');

const rangeRequestHandler = (req, res, filePath) => {
    const range = req.headers.range;
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filePath).toLowerCase();

    // Define content types for different file extensions
    const mimeTypes = {
        // Video formats
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        // Audio formats
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.aac': 'audio/aac'
    };

    let contentType = mimeTypes[ext] || 'application/octet-stream';

    // Check if this is an MKV file for video transcoding
    if (ext === '.mkv') {
        const ffmpeg = require('fluent-ffmpeg');
        
        // Set appropriate headers for MP4 streaming
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
        });
        
        // Transcode MKV to MP4 on-the-fly
        ffmpeg(filePath)
            .outputFormat('mp4')
            .outputOptions([
                '-movflags frag_keyframe+empty_moov',  // For streaming
                '-c:v copy',  // Copy video codec to avoid re-encoding
                '-c:a aac',   // Convert audio to AAC (browser compatible)
            ])
            .on('error', (err) => {
                console.error('Error transcoding MKV:', err);
                res.end();
            })
            .pipe(res, { end: true });
        return;
    }
    
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        res.writeHead(206, {
            'Content-Range' : `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': contentType
        });

        const stream = fs.createReadStream(filePath, {start, end});
        stream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType
        });
        fs.createReadStream(filePath).pipe(res);
    }
};

module.exports = rangeRequestHandler;