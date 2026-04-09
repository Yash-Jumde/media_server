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

    // Formats requiring on-the-fly MP4 transcoding
    const formatsToTranscode = ['.mkv', '.avi', '.wmv', '.flv'];

    if (formatsToTranscode.includes(ext)) {
        const ffmpeg = require('fluent-ffmpeg');
        
        // Ensure graceful connection close kills FFmpeg process
        res.on('close', () => {
             console.log(`[FFmpeg] Connection closed by client, killing stream for ${filePath}`);
        });

        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Connection': 'keep-alive'
        });
        
        // Transcode to MP4 on-the-fly with H.264 (Universal compatibility)
        const command = ffmpeg(filePath)
            .outputFormat('mp4')
            .outputOptions([
                '-movflags frag_keyframe+empty_moov',  // For streaming
                '-c:v libx264',    // Transcode to H.264 for browser compatibility
                '-preset ultrafast', // Minimize CPU latency for real-time
                '-crf 23',           // Standard quality/size trade-off
                '-c:a aac',          // Convert audio to AAC (browser compatible)
                '-threads 0'         // Use all available cores
            ])
            .on('error', (err) => {
                if (err.message.includes('Output stream closed') || err.message.includes('SIGKILL') || err.message.includes('ffmpeg was killed')) return; // normal on scrub/close
                console.error('Error transcoding file:', err);
                if (!res.headersSent) res.end();
            });

        req.connection.on('close', () => { command.kill('SIGKILL'); });

        command.pipe(res, { end: true });
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