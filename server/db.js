const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

// Resolve path to the database file (ignored in .gitignore)
const dbPath = path.join(__dirname, '../database/media.db');

let db;

/**
 * Initializes the SQLite database connection and runs the schema definition
 * if the database was just created.
 */
async function initializeDatabase() {
    return new Promise(async (resolve, reject) => {
        try {
            // Ensure the directory exists
            await fs.mkdir(path.dirname(dbPath), { recursive: true });
            
            db = new sqlite3.Database(dbPath, async (err) => {
                if (err) {
                    console.error('Error connecting to the database:', err.message);
                    return reject(err);
                }
                
                console.log('Connected to the SQLite database.');

                // Enable Foreign Keys
                db.run('PRAGMA foreign_keys = ON');

                try {
                    // Read and execute schema.sql
                    const schemaPath = path.join(__dirname, '../database/schema.sql');
                    const schemaSql = await fs.readFile(schemaPath, 'utf8');
                    
                    db.exec(schemaSql, (execErr) => {
                        if (execErr) {
                            console.error('Error executing schema:', execErr.message);
                            return reject(execErr);
                        }
                        console.log('Database schema verified/initialized.');
                        resolve();
                    });
                } catch (readErr) {
                    console.error('Error reading schema file:', readErr);
                    reject(readErr);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Wrapper for SELECT queries expecting multiple rows.
 */
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Wrapper for SELECT queries expecting a single row.
 */
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * Wrapper for INSERT, UPDATE, DELETE queries.
 */
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

module.exports = {
    initializeDatabase,
    all,
    get,
    run
};
