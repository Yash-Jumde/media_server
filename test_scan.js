require('dotenv').config();
const path = require('path');
const db = require('./server/db');
const { syncMediaWithDatabase } = require('./server/utils/fileScanner');

const MEDIA_DIR = path.join(__dirname, 'media');

async function test() {
    try {
        await db.initializeDatabase();
        console.log('DB Initialized, running sync...');
        await syncMediaWithDatabase(MEDIA_DIR);
        
        console.log('fetching rows from DB...');
        const count = await db.get('SELECT COUNT(*) as count FROM media_files');
        console.log('Total media files in DB:', count.count);
        process.exit(0);
    } catch (e) {
        console.error('Test Failed:', e);
        process.exit(1);
    }
}
test();
