const db = require('../server/db');

async function inspect() {
  await db.initializeDatabase();
  const rows = await db.all('SELECT id, category_id, filename, filepath, media_type, is_favorite, tmdb_poster_url FROM media_files');
  console.log(JSON.stringify(rows, null, 2));
  
  const favs = await db.all('SELECT * FROM media_files WHERE is_favorite = 1');
  console.log('\n--- Favorites (Raw) ---');
  console.log(JSON.stringify(favs, null, 2));

  const path = require('path');
  function formatMediaFile(row, overrideCategoryKey = null, overrideCategoryName = null) {
    let thumbnailPath = null;
    if (row.media_type === 'video') {
      thumbnailPath = row.thumbnail_path || `/thumbnails/${path.basename(row.filepath, path.extname(row.filepath))}.jpg`;
    } else if (row.media_type === 'audio') {
      thumbnailPath = `/covers/${path.basename(row.filepath, path.extname(row.filepath))}.jpg`;
    } else if (row.media_type === 'image') {
      thumbnailPath = `/images/${row.id}`;
    }

    return {
      id: row.id,
      name: row.title || row.filename,
      path: row.filepath,
      type: row.media_type,
      size: row.file_size,
      thumbnail: thumbnailPath,
      category: overrideCategoryKey || row.category_key,
      categoryDisplay: overrideCategoryName || row.category_display,
      tmdb_poster_url: row.tmdb_poster_url,
      tmdb_backdrop_url: row.tmdb_backdrop_url,
      tmdb_rating: row.tmdb_rating,
      tmdb_genres: row.tmdb_genres,
      tmdb_release_date: row.tmdb_release_date,
      tmdb_overview: row.tmdb_overview,
      tmdb_cast: row.tmdb_cast,
      tmdb_runtime: row.tmdb_runtime,
      is_favorite: Boolean(row.is_favorite)
    };
  }

  console.log('\n--- Favorites (Formatted) ---');
  console.log(JSON.stringify(favs.map(row => formatMediaFile(row)), null, 2));
}

inspect().catch(console.error);
