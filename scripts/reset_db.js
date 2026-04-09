const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'media.db');
const THUMBNAILS_DIR = path.join(__dirname, '..', 'public', 'thumbnails');
const COVERS_DIR = path.join(__dirname, '..', 'public', 'covers');

console.log('--- Media Server Hard Reset ---');

// 1. Delete Database
if (fs.existsSync(DB_PATH)) {
    console.log(`[DB] Deleting ${DB_PATH}...`);
    fs.unlinkSync(DB_PATH);
} else {
    console.log('[DB] No database file found to delete.');
}

// 2. Clear Thumbnails & Covers
const clearDirectory = (dir) => {
    if (fs.existsSync(dir)) {
        console.log(`[DIR] Clearing ${dir}...`);
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            }
        });
    } else {
        console.log(`[DIR] Directory ${dir} not found.`);
        fs.mkdirSync(dir, { recursive: true });
    }
};

clearDirectory(THUMBNAILS_DIR);
clearDirectory(COVERS_DIR);

console.log('\nReset Complete! Your actual media files were not touched.');
console.log('Run "npm run dev" to restart and rescrape with the new logic.');
