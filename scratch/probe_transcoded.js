const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const file = process.argv[2] || 'transcoded/300.mp4';

ffmpeg.ffprobe(file, (err, metadata) => {
    if (err) {
        console.error('Error probing:', err.message);
        return;
    }
    console.log(JSON.stringify(metadata, null, 2));
});
