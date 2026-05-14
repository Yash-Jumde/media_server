const fs = require('fs');
const path = require('path');

/**
 * Robust Range Request Handler for Media Streaming
 * Handles both partial content (206) and full file requests (200).
 */
const rangeRequestHandler = (req, res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();

    try {
        if (!fs.existsSync(filePath)) {
            console.error(`[Stream] File not found: ${filePath}`);
            return res.status(404).send('File not found');
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        const mimeTypes = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mkv': 'video/x-matroska',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.flac': 'audio/flac',
            '.aac': 'audio/aac'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                res.status(416).set('Content-Range', `bytes */${fileSize}`).send();
                return;
            }

            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            };

            res.writeHead(206, head);
            file.pipe(res);
            
            file.on('error', (err) => {
                console.error('[Stream] ReadStream Error:', err.message);
                if (!res.headersSent) res.status(500).end();
            });

            res.on('close', () => {
                file.destroy();
            });
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache'
            };
            res.writeHead(200, head);
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            
            res.on('close', () => {
                stream.destroy();
            });
        }
    } catch (error) {
        console.error('[Stream] Fatal Handler Error:', error.message);
        if (!res.headersSent) res.status(500).send('Internal Server Error');
    }
};

module.exports = rangeRequestHandler;