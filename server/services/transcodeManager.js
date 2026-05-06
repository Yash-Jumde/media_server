const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const { getHWEncoder } = require('../utils/helpers');
const db = require('../db');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobePath);

const CUVID_DECODERS = {
    'h264': 'h264_cuvid',
    'hevc': 'hevc_cuvid',
    'av1': 'av1_cuvid',
    'vp9': 'vp9_cuvid',
    'mpeg2video': 'mpeg2_cuvid',
};

class TranscodeManager {
    constructor() {
        this.queue = [];
        this.activeTasks = new Map(); // mediaId -> taskInfo
        this.progress = new Map(); // mediaId -> percent
        this.maxParallel = 2;
        this.transcodedDir = path.join(__dirname, '../../transcoded');

        if (!fs.existsSync(this.transcodedDir)) {
            fs.mkdirSync(this.transcodedDir, { recursive: true });
        }
    }

    async addToQueue(mediaId, filePath, force = false) {
        // Check if already in our internal queue or active tasks
        if (this.queue.some(t => t.mediaId === mediaId) || this.activeTasks.has(mediaId)) {
            return;
        }

        const outputPath = path.join(this.transcodedDir, `${mediaId}.mp4`);
        const lockPath = path.join(this.transcodedDir, `${mediaId}.lock`);
        const tempPath = path.join(this.transcodedDir, `${mediaId}.tmp.mp4`);

        // Check if already transcoded (must exist and be > 0 bytes)
        const isAlreadyDone = fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
        const isBeingTranscoded = fs.existsSync(lockPath) || fs.existsSync(tempPath);

        if (!force && (isAlreadyDone || isBeingTranscoded)) {
            return;
        }

        // Get file info for the queue display
        const file = await db.get('SELECT filename FROM media_files WHERE id = ?', [mediaId]);

        this.queue.push({
            mediaId,
            filePath,
            filename: file ? file.filename : path.basename(filePath),
            addedAt: new Date()
        });

        this.processQueue();
    }

    async processQueue() {
        while (this.activeTasks.size < this.maxParallel && this.queue.length > 0) {
            const task = this.queue.shift();
            this.startTask(task);
        }
    }

    async probeCodec(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, data) => {
                if (err) return reject(err);
                const video = data.streams.find(s => s.codec_type === 'video' && s.codec_name !== 'png');
                resolve(video ? video.codec_name : null);
            });
        });
    }

    async startTask(task) {
        const { mediaId, filePath } = task;
        this.activeTasks.set(mediaId, task);

        const outputPath = path.join(this.transcodedDir, `${mediaId}.mp4`);
        const tempPath = path.join(this.transcodedDir, `${mediaId}.tmp.mp4`);
        const lockPath = path.join(this.transcodedDir, `${mediaId}.lock`);

        // Get duration for progress calculation
        const media = await db.get('SELECT duration FROM media_files WHERE id = ?', [mediaId]);
        const durationSeconds = media ? media.duration : 0;

        console.log(`[TranscodeManager] Starting: ${task.filename}`);
        fs.writeFileSync(lockPath, new Date().toISOString());

        const hwEncoder = getHWEncoder();
        let cuvidDecoder = null;

        try {
            const codec = await this.probeCodec(filePath);
            cuvidDecoder = CUVID_DECODERS[codec] || null;
        } catch (err) {
            console.error(`[TranscodeManager] Probe failed for ${task.filename}:`, err.message);
        }

        const runFFmpeg = (useHWAccel) => new Promise((resolve) => {
            const inputOpts = useHWAccel && cuvidDecoder
                ? ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda', '-c:v', cuvidDecoder]
                : [];

            // Standardize output to 1080p for better browser compatibility, especially for 4K sources
            const scaleFilter = useHWAccel 
                ? 'scale_cuda=1920:-2:format=yuv420p' 
                : 'scale=1920:-2:force_original_aspect_ratio=decrease,format=yuv420p';

            const outputOpts = useHWAccel && cuvidDecoder && hwEncoder.includes('nvenc')
                ? [
                    '-movflags +faststart',
                    '-map 0:v:0',
                    '-map 0:a:0?',
                    '-sn',
                    `-c:v ${hwEncoder}`,
                    '-preset', 'p4',
                    '-cq', '23',
                    '-vf', scaleFilter,
                    '-c:a', 'aac', '-ac', '2', '-b:a', '192k'
                ]
                : [
                    '-movflags +faststart',
                    '-map 0:v:0',
                    '-map 0:a:0?',
                    '-sn',
                    `-c:v ${hwEncoder === 'libx264' ? 'libx264' : hwEncoder}`,
                    '-vf', scaleFilter,
                    '-c:a', 'aac', '-ac', '2', '-b:a', '192k'
                ];

            ffmpeg(filePath)
                .inputOptions(inputOpts)
                .outputOptions(outputOpts)
                .output(tempPath)
                .on('progress', (progress) => {
                    let percent = progress.percent;
                    if (!percent && durationSeconds > 0 && progress.timemark) {
                        const parts = progress.timemark.split(':');
                        const seconds = (+parts[0]) * 60 * 60 + (+parts[1]) * 60 + (+parts[2]);
                        percent = (seconds / durationSeconds) * 100;
                    }
                    if (percent) {
                        this.progress.set(mediaId, Math.min(Math.round(percent), 100));
                    }
                })
                .on('end', () => {
                    try { 
                        if (fs.existsSync(tempPath)) fs.renameSync(tempPath, outputPath);
                        if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); 
                    } catch(e) {}
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
            console.error(`[TranscodeManager] HW acceleration failed for ${task.filename}, retrying with CPU decode...`);
            await runFFmpeg(false);
        }

        if (fs.existsSync(lockPath)) {
            try { fs.unlinkSync(lockPath); } catch(e) {}
        }

        this.progress.delete(mediaId);
        this.activeTasks.delete(mediaId);
        console.log(`[TranscodeManager] Finished: ${task.filename}`);
        this.processQueue();
    }

    async getQueueStatus() {
        const activeTasks = [];
        const trackedMediaIds = new Set();

        for (const [mediaId, taskInfo] of this.activeTasks.entries()) {
            trackedMediaIds.add(mediaId);
            activeTasks.push({
                ...taskInfo,
                progress: this.progress.get(mediaId) || 0
            });
        }

        // --- SCAN FOR EXTERNAL TASKS ---
        try {
            const files = fs.readdirSync(this.transcodedDir);
            const lockFiles = files.filter(f => f.endsWith('.lock'));
            const tmpFiles = files.filter(f => f.endsWith('.tmp.mp4'));

            const externalIds = new Set([
                ...lockFiles.map(f => parseInt(f.replace('.lock', ''))),
                ...tmpFiles.map(f => parseInt(f.replace('.tmp.mp4', '')))
            ]);

            for (const mediaId of externalIds) {
                if (!isNaN(mediaId) && !trackedMediaIds.has(mediaId)) {
                    trackedMediaIds.add(mediaId);
                    const file = await db.get('SELECT filename, file_size FROM media_files WHERE id = ?', [mediaId]);
                    
                    let estimatedProgress = 0;
                    try {
                        const tmpPath = path.join(this.transcodedDir, `${mediaId}.tmp.mp4`);
                        if (fs.existsSync(tmpPath) && file && file.file_size > 0) {
                            const tmpSize = fs.statSync(tmpPath).size;
                            // Re-calibrated estimation: 4K/HEVC to 1080p/H264 is often ~10-20% of original size.
                            // We'll use 0.15 as a safer, more conservative factor.
                            const estimatedFinalSize = file.file_size * 0.15;
                            estimatedProgress = Math.min(Math.round((tmpSize / estimatedFinalSize) * 100), 99);
                        }
                    } catch (err) {}

                    activeTasks.push({
                        mediaId,
                        filename: file ? file.filename : `Media ${mediaId}`,
                        progress: estimatedProgress || 0,
                        isExternal: true
                    });
                }
            }
        } catch (e) {
            console.error('[TranscodeManager] Error scanning for external tasks:', e);
        }

        return {
            activeTasks: activeTasks,
            queue: this.queue,
            isProcessing: activeTasks.length > 0
        };
    }

    getProgress(mediaId) {
        return this.progress.get(mediaId) || null;
    }

    isTranscoding(mediaId) {
        return this.activeTasks.has(mediaId) || this.queue.some(t => t.mediaId === mediaId);
    }
}

module.exports = new TranscodeManager();