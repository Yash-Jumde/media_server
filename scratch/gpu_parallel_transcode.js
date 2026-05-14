const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const sqlite3 = require('sqlite3').verbose();
const { getHWEncoder } = require('../server/utils/helpers');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobePath);

const DB_PATH = path.join(__dirname, '../database/media.db');
const MEDIA_DIR = path.join(__dirname, '../media');
const TRANSCODED_DIR = path.join(__dirname, '../transcoded');
const MAX_PARALLEL = 2;

if (!fs.existsSync(TRANSCODED_DIR)) {
    fs.mkdirSync(TRANSCODED_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

const CUVID_DECODERS = {
    'h264': 'h264_cuvid',
    'hevc': 'hevc_cuvid',
    'av1': 'av1_cuvid',
    'vp9': 'vp9_cuvid',
    'mpeg2video': 'mpeg2_cuvid',
};

function probeCodec(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) return reject(err);
            const video = data.streams.find(s => s.codec_type === 'video' && s.codec_name !== 'png');
            resolve(video ? video.codec_name : null);
        });
    });
}

async function getMovies() {
    return new Promise((resolve, reject) => {
        db.all("SELECT id, filepath, filename FROM media_files WHERE category_id = 1", (err, rows) => {
            if (err) reject(err);
            else {
                const filtered = rows.filter(row => {
                    const ext = path.extname(row.filepath).toLowerCase();
                    return ['.mkv', '.avi', '.wmv', '.flv'].includes(ext);
                });
                resolve(filtered);
            }
        });
    });
}

function resolveMediaRoot(relativePath) {
    if (!relativePath) return relativePath;
    if (path.isAbsolute(relativePath)) return relativePath;
    return path.join(MEDIA_DIR, relativePath);
}

class ProgressBar {
    constructor(total, label) {
        this.total = total;
        this.label = label;
        this.current = 0;
    }
    update(percent) { this.current = percent; }
    render() {
        const width = 30;
        const completed = Math.round((this.current / 100) * width);
        const bar = '='.repeat(completed) + '-'.repeat(width - completed);
        return `${this.label.padEnd(40)} [${bar}] ${this.current.toFixed(1)}%`;
    }
}

const bars = new Map();
const readline = require('readline');
let lastRender = 0;

function renderAll(force = false) {
    const now = Date.now();
    if (!force && now - lastRender < 2000) return;
    lastRender = now;
    if (process.stdout.isTTY) {
        readline.cursorTo(process.stdout, 0, 0);
        readline.clearScreenDown(process.stdout);
    } else if (force) {
        console.log('\n--- Transcode Status ---');
    } else {
        return;
    }
    console.log(`Parallel GPU Transcoding (Max: ${MAX_PARALLEL})`);
    console.log('--------------------------------------------------');
    for (const [id, bar] of bars) {
        console.log(bar.render());
    }
}

async function transcode(movie, encoder) {
    const inputPath = resolveMediaRoot(movie.filepath);
    const outputPath = path.join(TRANSCODED_DIR, `${movie.id}.mp4`);
    const tempPath = path.join(TRANSCODED_DIR, `${movie.id}.tmp.mp4`);

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000000) {
        const bar = new ProgressBar(100, movie.filename);
        bar.update(100);
        bars.set(movie.id, bar);
        renderAll(true);
        return;
    }

    const bar = new ProgressBar(100, movie.filename);
    bars.set(movie.id, bar);
    renderAll(true);

    // Probe codec to pick the right CUVID decoder
    let cuvidDecoder = null;
    try {
        const codec = await probeCodec(inputPath);
        cuvidDecoder = CUVID_DECODERS[codec] || null;
        fs.appendFileSync('transcode_debug.log',
            `[${new Date().toISOString()}] ${movie.filename} codec=${codec} cuvid=${cuvidDecoder}\n`);
    } catch (err) {
        fs.appendFileSync('transcode_debug.log',
            `[${new Date().toISOString()}] Probe failed for ${movie.filename}: ${err.message}\n`);
    }

    const runFFmpeg = (useHWAccel) => new Promise((resolve) => {
        const inputOpts = useHWAccel && cuvidDecoder
            ? ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda', '-c:v', cuvidDecoder]
            : [];

        const outputOpts = useHWAccel && cuvidDecoder
            ? [
                '-y',
                '-movflags +faststart',
                '-map 0:v:0',
                '-map 0:a:0?',
                '-sn',
                `-c:v ${encoder}`,
                '-preset', 'p4',
                '-cq', '23',
                // Downscale to 1080p if larger, preserving aspect ratio
                '-vf', 'scale_cuda=w=\'min(1920,iw)\':h=\'min(1080,ih)\':force_original_aspect_ratio=decrease,scale_cuda=format=yuv420p',
                '-c:a', 'aac', '-ac', '2', '-b:a', '192k'
            ]
            : [
                '-y',
                '-movflags +faststart',
                '-map 0:v:0',
                '-map 0:a:0?',
                '-sn',
                `-c:v ${encoder}`,
                '-preset', 'p4',
                '-cq', '23',
                // Downscale to 1080p if larger, preserving aspect ratio
                '-vf', 'scale=\'min(1920,iw)\':\'min(1080,ih)\':force_original_aspect_ratio=decrease',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-ac', '2', '-b:a', '192k'
            ];

        ffmpeg(inputPath)
            .inputOptions(inputOpts)
            .outputOptions(outputOpts)
            .output(tempPath)
            .on('start', (cmd) => {
                fs.appendFileSync('transcode_debug.log',
                    `[${new Date().toISOString()}] [hwaccel=${useHWAccel}] ${cmd}\n`);
            })
            .on('progress', (progress) => {
                if (progress.percent) bar.update(progress.percent);
                renderAll();
            })
            .on('end', () => {
                try {
                    fs.renameSync(tempPath, outputPath);
                    bar.update(100);
                    renderAll(true);
                } catch (err) {
                    console.error(`\nError renaming ${movie.filename}:`, err.message);
                }
                resolve({ success: true });
            })
            .on('error', (err) => {
                if (fs.existsSync(tempPath)) {
                    try { fs.unlinkSync(tempPath); } catch (e) { }
                }
                resolve({ success: false, error: err.message });
            })
            .run();
    });

    const result = await runFFmpeg(true);
    if (!result.success) {
        fs.appendFileSync('transcode_debug.log',
            `[${new Date().toISOString()}] HW decode failed for ${movie.filename}, retrying CPU: ${result.error}\n`);
        console.error(`\n[${movie.filename}] HW decode failed, retrying with CPU decode...`);
        const fallback = await runFFmpeg(false);
        if (!fallback.success) {
            console.error(`\n[${movie.filename}] CPU fallback also failed: ${fallback.error}`);
        }
    }
}

async function main() {
    const encoder = getHWEncoder();
    console.log(`Using encoder: ${encoder}`);

    const movies = await getMovies();
    console.log(`Found ${movies.length} movies.`);

    const queue = [...movies];

    async function processQueue() {
        while (queue.length > 0) {
            const movie = queue.shift();
            await transcode(movie, encoder);
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(MAX_PARALLEL, movies.length); i++) {
        workers.push(processQueue());
    }

    await Promise.all(workers);
    console.log('\nAll transcodings finished.');
    db.close();
}

main().catch(console.error);