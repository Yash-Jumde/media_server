const db = require('../server/db');
const path = require('path');

async function check() {
    try {
        await db.initializeDatabase();
        const rows = await db.all('SELECT id, filename, filepath FROM media_files LIMIT 10');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    }
}

check();
