const db = require('../server/db');
const path = require('path');

async function checkMedia() {
    try {
        await db.initializeDatabase();
        const row = await db.get('SELECT * FROM media_files WHERE id = 4');
        console.log(JSON.stringify(row, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkMedia();
