const db = require('../server/db');
const fs = require('fs');
const path = require('path');

async function checkStatus() {
    try {
        await db.initializeDatabase();
        const files = await db.all(`
            SELECT mf.id, mf.filename, mf.filepath 
            FROM media_files mf
            JOIN categories c ON mf.category_id = c.id
            WHERE filepath LIKE '%.mkv' OR filepath LIKE '%.avi'
        `);
        
        console.log(`Found ${files.length} files that might need transcoding.`);
        
        const transcodedDir = path.join(__dirname, '../transcoded');
        let countCached = 0;
        
        for (const file of files) {
            const outputPath = path.join(transcodedDir, `${file.id}.mp4`);
            if (fs.existsSync(outputPath)) {
                countCached++;
            } else {
                console.log(`- ${file.filename} (ID: ${file.id}) is NOT transcoded.`);
            }
        }
        
        console.log(`Summary: ${countCached} / ${files.length} files are cached.`);
        
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkStatus();
