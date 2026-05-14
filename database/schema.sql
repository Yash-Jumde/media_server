-- Categories table (e.g. Movies, TV Shows, Audio, Images)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL
);

-- Pre-populate default categories
INSERT OR IGNORE INTO categories (key_name, display_name) VALUES 
('movies', 'Movies'),
('tv_shows', 'TV Shows'),
('images', 'Images'),
('audio', 'Audio');

-- Series table for TV shows
CREATE TABLE IF NOT EXISTS series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    poster_path TEXT,
    tmdb_id INTEGER,
    tmdb_poster_url TEXT,
    tmdb_backdrop_url TEXT,
    tmdb_rating REAL,
    tmdb_genres TEXT,
    tmdb_first_air_date TEXT,
    tmdb_overview TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Media Files table
CREATE TABLE IF NOT EXISTS media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    series_id INTEGER,
    filename TEXT NOT NULL,
    filepath TEXT UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    duration INTEGER,
    file_size INTEGER,
    format TEXT,
    resolution TEXT,
    thumbnail_path TEXT,
    media_type TEXT NOT NULL,
    episode_num INTEGER,
    season_num INTEGER,
    -- TMDB metadata
    tmdb_id INTEGER,
    tmdb_poster_url TEXT,
    tmdb_backdrop_url TEXT,
    tmdb_rating REAL,
    tmdb_genres TEXT,
    tmdb_release_date TEXT,
    tmdb_overview TEXT,
    tmdb_cast TEXT,
    tmdb_runtime INTEGER,
    -- Status
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id),
    FOREIGN KEY (series_id) REFERENCES series (id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_category ON media_files(category_id);
CREATE INDEX IF NOT EXISTS idx_media_series ON media_files(series_id);

-- Users table (multi-user ready, single admin for now)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    avatar_url TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Watch history / playback progress
CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    media_id INTEGER,
    progress INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media_files (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_unique ON watch_history(user_id, media_id);

-- Favorites table (separate for flexibility)
CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    media_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media_files (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unique ON favorites(user_id, media_id);