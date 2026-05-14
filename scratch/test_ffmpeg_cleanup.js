const http = require('http');

const PORT = 5000; // Correct port from .env
const VIDEO_ID = 1; // Change to a valid video ID that requires transcoding

console.log(`Connecting to stream for video ID ${VIDEO_ID}...`);

const req = http.get(`http://localhost:${PORT}/stream/${VIDEO_ID}`, (res) => {
    console.log(`Response received: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    // Read some data
    res.on('data', (chunk) => {
        console.log(`Received chunk of size ${chunk.length}`);
        
        // After receiving first chunk, abort the request
        console.log('Aborting request to simulate client disconnect...');
        req.destroy();
    });

    res.on('end', () => {
        console.log('Stream ended');
    });
});

req.on('error', (err) => {
    console.log('Caught expected error from destroy:', err.message);
});

setTimeout(() => {
    console.log('Checking for remaining ffmpeg processes...');
    const { execSync } = require('child_process');
    try {
        const pids = execSync('pgrep ffmpeg').toString().trim();
        console.log(`Found ffmpeg processes with PIDs: ${pids}`);
    } catch (e) {
        console.log('No ffmpeg processes found. Success!');
    }
}, 5000);
