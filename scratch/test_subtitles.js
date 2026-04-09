const fs = require('fs');
const path = require('path');

const mediaPath = '/home/waltazar/media_server/media_server/media/movies/Reservoir Dogs (1992) [1080p]/Reservoir Dogs (1992).mp4';
const mediaDir = path.dirname(mediaPath);

console.log('Media Dir:', mediaDir);

try {
    const files = fs.readdirSync(mediaDir);
    console.log('Files:', files);
    const srtFile = files.find(f => f.toLowerCase().endsWith('.srt'));
    console.log('SRT File found:', srtFile);
    
    if (srtFile) {
        const srtPath = path.join(mediaDir, srtFile);
        console.log('SRT Path:', srtPath);
        console.log('SRT Exists:', fs.existsSync(srtPath));
    } else {
        console.log('No SRT file found ending in .srt');
    }
} catch (e) {
    console.error('Error:', e);
}
