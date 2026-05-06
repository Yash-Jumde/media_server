const db = require('../server/db');
const path = require('path');
const fs = require('fs');

async function seed() {
    try {
        console.log('Initializing database connection...');
        await db.initializeDatabase();

        // 1. Get Category ID for TV Shows
        const row = await db.get('SELECT id FROM categories WHERE key_name = ?', ['tv_shows']);
        if (!row) {
            console.error('Category "tv_shows" not found. Please run the server first to initialize categories.');
            process.exit(1);
        }
        const categoryId = row.id;

        // 2. Mock Series Data
        const seriesData = [
            {
                name: 'The Antigravity Chronicles',
                description: 'A mind-bending journey through floating cities and the secrets of the void.',
                tmdb_poster_url: '/thumbnails/antigravity.png',
                tmdb_backdrop_url: '/thumbnails/antigravity.png',
                tmdb_rating: 9.2,
                genres: 'Sci-Fi, Adventure, Mystery',
                first_air: '2024-01-15'
            },
            {
                name: 'Code Whisperer',
                description: 'A tech thriller following a brilliant hacker who can see the underlying logic of the world.',
                tmdb_poster_url: '/thumbnails/codewhisperer.png',
                tmdb_backdrop_url: '/thumbnails/codewhisperer.png',
                tmdb_rating: 8.7,
                genres: 'Thriller, Tech, Drama',
                first_air: '2023-05-10'
            }
        ];

        for (const s of seriesData) {
            console.log(`Upserting series: ${s.name}`);
            let existing = await db.get('SELECT id FROM series WHERE name = ?', [s.name]);
            let seriesId;
            if (!existing) {
                const res = await db.run(
                    `INSERT INTO series (name, description, tmdb_poster_url, tmdb_backdrop_url, tmdb_rating, tmdb_genres, tmdb_first_air_date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [s.name, s.description, s.tmdb_poster_url, s.tmdb_backdrop_url, s.tmdb_rating, s.genres, s.first_air]
                );
                seriesId = res.id;
            } else {
                seriesId = existing.id;
                await db.run(
                    `UPDATE series SET description = ?, tmdb_poster_url = ?, tmdb_backdrop_url = ?, tmdb_rating = ?, tmdb_genres = ?, tmdb_first_air_date = ?
                     WHERE id = ?`,
                    [s.description, s.tmdb_poster_url, s.tmdb_backdrop_url, s.tmdb_rating, s.genres, s.first_air, seriesId]
                );
            }

            // 3. Mock Episodes for this series
            const episodes = [];
            if (s.name === 'The Antigravity Chronicles') {
                episodes.push(
                    {
                        filename: 'S01E01 - The Spark.mp4',
                        filepath: path.resolve('media/tv_shows/The Antigravity Chronicles/Season 01/S01E01 - The Spark.mp4'),
                        title: 'The Spark',
                        s: 1, e: 1, duration: 3200
                    },
                    {
                        filename: 'S01E02 - Into the Void.mp4',
                        filepath: path.resolve('media/tv_shows/The Antigravity Chronicles/Season 01/S01E02 - Into the Void.mp4'),
                        title: 'Into the Void',
                        s: 1, e: 2, duration: 3150
                    }
                );
            } else if (s.name === 'Code Whisperer') {
                episodes.push(
                    {
                        filename: 'S01E01 - Hello World.mp4',
                        filepath: path.resolve('media/tv_shows/Code Whisperer/Season 01/S01E01 - Hello World.mp4'),
                        title: 'Hello World',
                        s: 1, e: 1, duration: 2800
                    }
                );
            }

            for (const ep of episodes) {
                console.log(`  Adding episode: ${ep.filename}`);
                const exit = await db.get('SELECT id FROM media_files WHERE filepath = ?', [ep.filepath]);
                if (!exit) {
                    await db.run(
                        `INSERT INTO media_files 
                        (category_id, series_id, filename, filepath, title, media_type, episode_num, season_num, duration, tmdb_poster_url) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [categoryId, seriesId, ep.filename, ep.filepath, ep.title, 'video', ep.e, ep.s, ep.duration, s.tmdb_poster_url]
                    );
                } else {
                     await db.run(
                        `UPDATE media_files SET series_id = ?, title = ?, episode_num = ?, season_num = ?, duration = ?, tmdb_poster_url = ?
                         WHERE id = ?`,
                        [seriesId, ep.title, ep.e, ep.s, ep.duration, s.tmdb_poster_url, exit.id]
                    );
                }
            }
        }

        console.log('Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seed();
