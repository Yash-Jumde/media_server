const { execSync } = require('child_process');
const ffprobe = require('ffprobe-static');
const path = require('path');

const filePath = path.join(__dirname, '..', 'media', 'movies', 'Batman', 'The.Batman.2022.mkv');
const result = execSync(`"${ffprobe.path}" -v quiet -print_format json -show_streams "${filePath}"`).toString();
const data = JSON.parse(result);

data.streams.forEach(s => {
  console.log(`${s.codec_type}: codec=${s.codec_name} profile=${s.profile} channels=${s.channels} sample_rate=${s.sample_rate} pix_fmt=${s.pix_fmt} level=${s.level}`);
});
