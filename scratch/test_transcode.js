const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const path = require('path');

const input = path.join(__dirname, '../media/movies/Batman/The.Batman.2022.mkv');
const output = path.join(__dirname, '../test_batman.mp4');

try {
    console.log('Starting test transcode...');
    execSync(`"${ffmpeg}" -y -i "${input}" -t 10 -c:v h264_nvenc -pix_fmt yuv420p -c:a aac -movflags +faststart -f mp4 "${output}"`, { stdio: 'inherit' });
    console.log('Test transcode finished.');
} catch (err) {
    console.error('Test transcode failed:', err.message);
}
