const https = require('https');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const db = require('../db');

const TMDB_BASE_URL = 'api.themoviedb.org';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const CACHE_PATH = path.join(__dirname, '../../database/metadata_cache.json');

class TMDBScraper {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.enabled = !!apiKey && apiKey !== 'YOUR_TMDB_API_KEY_HERE';
        this.cache = {};

        if (!this.enabled) {
            console.log('[TMDB] No API key configured. Metadata scraping is disabled.');
        } else {
            console.log('[TMDB] Scraper initialized.');
            this.loadCache();
        }
    }

    async loadCache() {
        try {
            if (fsSync.existsSync(CACHE_PATH)) {
                const data = await fs.readFile(CACHE_PATH, 'utf8');
                this.cache = JSON.parse(data);
                console.log(`[TMDB] Loaded ${Object.keys(this.cache).length} items from metadata cache.`);
            }
        } catch (error) {
            console.error('[TMDB] Error loading cache:', error);
            this.cache = {};
        }
    }

    async saveCache() {
        try {
            await fs.writeFile(CACHE_PATH, JSON.stringify(this.cache, null, 2));
        } catch (error) {
            console.error('[TMDB] Error saving cache:', error);
        }
    }

    async fetchJSON(urlPath, retries = 5) {
        if (!this.enabled) return null;

        for (let i = 0; i < retries; i++) {
            try {
                return await new Promise((resolve, reject) => {
                    const options = {
                        hostname: TMDB_BASE_URL,
                        path: urlPath,
                        method: 'GET',
                        headers: { 
                            'Accept': 'application/json',
                            'User-Agent': 'MediaServer/1.0 (Modernized Scraper)'
                        },
                        timeout: 10000,
                        agent: false // Disable connection pooling to prevent ECONNRESET
                    };

                    const req = https.request(options, (res) => {
                        let data = '';
                        res.on('data', (chunk) => data += chunk);
                        res.on('end', () => {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });

                    req.on('timeout', () => {
                        req.destroy();
                        reject(new Error('Request timeout'));
                    });

                    req.on('error', reject);
                    req.end();
                });
            } catch (error) {
                if (i === retries - 1) throw error;
                const delay = Math.pow(2, i) * 1000;
                console.log(`[TMDB] Retry ${i + 1}/${retries} for ${urlPath} (Error: ${error.message}). Waiting ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    cleanTitle(filename) {
        let name = filename
            .replace(/\.[^/.]+$/, '')           // Remove extension
            .replace(/S\d+E\d+.*/i, '')         // Remove SxxExx
            .replace(/\d+x\d+.*/i, '')          // Remove 1x01
            .replace(/\(\d{4}\)/, '')            // Remove (2023)
            .replace(/\[\d{4}\]/, '')            // Remove [2023]
            // Standard rip noise & quality tags
            .replace(/(1080p|720p|2160p|4k|uhd|bluray|h264|h265|x264|x265|10bit|aac[.\d]*|dts|web-dl|webrip|proper|remux|repack|hevc|hdr|dd\+?\d?|6ch|5\.1|aac|mp3|xvid|web)/gi, '')
            // Release groups & sites
            .replace(/(yts\.mx|yts\.ag|pahe\.in|psa|rarbg|eztv|yify|juggs|tiga|etrg|ozlem|shaanig|ganool|fgt|evo)/gi, '')
            .replace(/[._-]/g, ' ')             // Replace separators
            .replace(/\[\s*\]|\(\s*\)|\{\s*\}/g, '') // Remove empty boxes like [] () {}
            .replace(/\s+/g, ' ')               // Collapse whitespace
            .trim();

        return name;
    }

    extractYear(filename) {
        const match = filename.match(/[(\[]?(\d{4})[)\]]?/);
        if (match) {
            const year = parseInt(match[1]);
            if (year >= 1900 && year <= new Date().getFullYear() + 1) {
                return year;
            }
        }
        return null;
    }

    async searchMovie(title, year = null) {
        if (!this.enabled) return null;

        // Check Cache First
        const cacheKey = `${title}_${year || 'any'}`.toLowerCase();
        if (this.cache[cacheKey]) {
            console.log(`[TMDB] Cache Hit: "${title}"`);
            return this.cache[cacheKey];
        }

        let data = await this.fetchJSON(`/3/search/movie?api_key=${this.apiKey}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`);

        // Fallback: search without year if no results
        if ((!data || !data.results || data.results.length === 0) && year) {
            console.log(`[TMDB] No results with year for "${title}", trying title only...`);
            data = await this.fetchJSON(`/3/search/movie?api_key=${this.apiKey}&query=${encodeURIComponent(title)}`);
        }

        if (data && data.results && data.results.length > 0) {
            const result = data.results[0];
            // Save to Cache
            this.cache[cacheKey] = result;
            this.saveCache();
            return result;
        }
        return null;
    }

    async searchTV(title) {
        if (!this.enabled) return null;

        const query = `/3/search/tv?api_key=${this.apiKey}&query=${encodeURIComponent(title)}`;

        try {
            const data = await this.fetchJSON(query);
            if (data && data.results && data.results.length > 0) {
                return data.results[0];
            }
        } catch (error) {
            console.error(`[TMDB] TV search failed for "${title}":`, error.message);
        }
        return null;
    }

    async getMovieDetails(tmdbId) {
        if (!this.enabled || !tmdbId) return null;

        try {
            const data = await this.fetchJSON(
                `/3/movie/${tmdbId}?api_key=${this.apiKey}&append_to_response=credits`
            );
            return data;
        } catch (error) {
            console.error(`[TMDB] Details failed for movie ${tmdbId}:`, error.message);
        }
        return null;
    }

    async getTVDetails(tmdbId) {
        if (!this.enabled || !tmdbId) return null;

        try {
            const data = await this.fetchJSON(
                `/3/tv/${tmdbId}?api_key=${this.apiKey}&append_to_response=credits`
            );
            return data;
        } catch (error) {
            console.error(`[TMDB] Details failed for TV ${tmdbId}:`, error.message);
        }
        return null;
    }

    formatCast(credits) {
        if (!credits || !credits.cast) return null;
        return credits.cast
            .slice(0, 10)
            .map(c => c.name)
            .join(', ');
    }

    formatGenres(genres) {
        if (!genres) return null;
        return genres.map(g => g.name).join(', ');
    }

    posterUrl(posterPath, size = 'w500') {
        if (!posterPath) return null;
        return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
    }

    backdropUrl(backdropPath, size = 'w1280') {
        if (!backdropPath) return null;
        return `${TMDB_IMAGE_BASE}/${size}${backdropPath}`;
    }

    async scrapeMovieMetadata(mediaFileRow) {
        if (!this.enabled) return;
        if (mediaFileRow.tmdb_id) return; // Already scraped

        const cleanedTitle = this.cleanTitle(mediaFileRow.filename);
        const year = this.extractYear(mediaFileRow.filename);

        console.log(`[TMDB] Searching movie: "${cleanedTitle}" (${year || 'no year'})`);

        const searchResult = await this.searchMovie(cleanedTitle, year);
        if (!searchResult) {
            console.log(`[TMDB] No results for: "${cleanedTitle}"`);
            return;
        }

        const details = await this.getMovieDetails(searchResult.id);
        if (!details) return;

        await db.run(
            `UPDATE media_files SET 
                tmdb_id = ?, tmdb_poster_url = ?, tmdb_backdrop_url = ?,
                tmdb_rating = ?, tmdb_genres = ?, tmdb_release_date = ?,
                tmdb_overview = ?, tmdb_cast = ?, tmdb_runtime = ?,
                title = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
                details.id,
                this.posterUrl(details.poster_path),
                this.backdropUrl(details.backdrop_path),
                details.vote_average,
                this.formatGenres(details.genres),
                details.release_date,
                details.overview,
                this.formatCast(details.credits),
                details.runtime,
                details.title,
                mediaFileRow.id
            ]
        );

        console.log(`[TMDB] Scraped: "${details.title}" (${details.release_date})`);
    }

    async scrapeSeriesMetadata(seriesRow) {
        if (!this.enabled) return;
        if (seriesRow.tmdb_id) return; // Already scraped

        console.log(`[TMDB] Searching TV series: "${seriesRow.name}"`);

        const searchResult = await this.searchTV(seriesRow.name);
        if (!searchResult) {
            console.log(`[TMDB] No results for TV: "${seriesRow.name}"`);
            return;
        }

        const details = await this.getTVDetails(searchResult.id);
        if (!details) return;

        await db.run(
            `UPDATE series SET 
                tmdb_id = ?, tmdb_poster_url = ?, tmdb_backdrop_url = ?,
                tmdb_rating = ?, tmdb_genres = ?, tmdb_first_air_date = ?,
                tmdb_overview = ?
            WHERE id = ?`,
            [
                details.id,
                this.posterUrl(details.poster_path),
                this.backdropUrl(details.backdrop_path),
                details.vote_average,
                this.formatGenres(details.genres),
                details.first_air_date,
                details.overview,
                seriesRow.id
            ]
        );

        console.log(`[TMDB] Scraped TV: "${details.name}" (${details.first_air_date})`);
    }

    async scrapeAll() {
        if (!this.enabled) {
            console.log('[TMDB] Scraping skipped - no API key configured.');
            return;
        }

        console.log('[TMDB] Starting metadata scrape for all unscraped media...');

        // Scrape movies
        const movies = await db.all(
            `SELECT mf.* FROM media_files mf 
             JOIN categories c ON mf.category_id = c.id 
             WHERE c.key_name = 'movies' 
             AND mf.media_type = 'video'
             AND mf.tmdb_id IS NULL`
        );

        for (const movie of movies) {
            await this.scrapeMovieMetadata(movie);
            // Rate limiting - be kind to TMDB
            await new Promise(r => setTimeout(r, 300));
        }

        // Scrape TV series
        const allSeries = await db.all('SELECT * FROM series WHERE tmdb_id IS NULL');
        for (const s of allSeries) {
            await this.scrapeSeriesMetadata(s);
            await new Promise(r => setTimeout(r, 300));
        }

        console.log('[TMDB] Metadata scrape complete.');
    }
}

module.exports = TMDBScraper;
