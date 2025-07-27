const chokidar = require('chokidar');
const ffprobe = require('ffprobe-static');
const {exec} = require('child_process');
const path = require('path');
const { resolve } = require('dns');
const { rejects } = require('assert');
const { error } = require('console');
const { stdout } = require('process');

class MediaWatcher {
    constructor(mediaPath, database) {
        this.mediaPath = mediaPath;
        this.db = database;
        this.watcher = null;
    }

    start() {
        this.watcher = chokidar.watch(this.mediaPath, {
            ignored: /^\./,
            persistent: true,
            ignoreInitial: false
        });

        this.watcher
            .on('add', path => this.handleFileAdded(path))
            .on('unlink', path => this.handleFileRemoved(path))
            .on('change', path => this.handleFileChanged(path));
    }

    async handleFileAdded(filePath) {
        if(this.isMediaFile(filePath)) {
            const metadata = await this.extractMetadata(filePath);
            const thumbnail = await this.generateThumbnail(filePath);
            await this.db.addMediaFile({
                ...metadata,
                filePath: filePath,
                thumbnail_path: thumbnail
            });
        }
    }

    async extractMetadata(filePath) {
        return new Promise((resolve, reject) => {
            exec(`${ffprobe.path} -v quiet -print_format json -show_format -show_streams "${filePath}"`,
                (error, stdout) => {
                    if(error) reject(error);
                    const data = JSON.parse(stdout);
                    resolve({
                        duration: Math.floor(data.format.duration),
                        format: data.format.format_name,
                        resolution: `${data.streams[0].width}x${data.streams[0].height}`,
                        file_size: data.format.size
                    });
                }
            );
        });
    }
}