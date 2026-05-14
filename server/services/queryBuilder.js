const db = require('../db');

/**
 * Dynamically builds and executes SQLite queries for media exploration.
 * Supports filtering, sorting, and pagination.
 */
class QueryBuilder {
  /**
   * Builds the explore query based on parameters.
   */
  static async buildExploreQuery(userId, params) {
    const {
      category,
      genre,
      sort = 'created_at',
      order = 'DESC',
      search,
      limit = 20,
      offset = 0
    } = params;

    let query = '';
    let countQuery = '';
    const queryParams = [];
    const countParams = [];
    const isTV = category === 'tv_shows';

    if (isTV) {
      // Base query for Series
      query = `
        SELECT s.*, 
               (SELECT COUNT(*) FROM media_files WHERE series_id = s.id) as episode_count,
               f.id as favorite_id
        FROM series s
        LEFT JOIN favorites f ON f.media_id = (SELECT id FROM media_files WHERE series_id = s.id LIMIT 1) AND f.user_id = ?
      `;
      countQuery = `SELECT COUNT(*) as total FROM series s`;
      queryParams.push(userId);
    } else {
      // Base query for Media Files
      query = `
        SELECT mf.*, c.key_name as category_key, c.display_name as category_display, f.id as favorite_id 
        FROM media_files mf
        JOIN categories c ON mf.category_id = c.id
        LEFT JOIN favorites f ON mf.id = f.media_id AND f.user_id = ?
      `;
      countQuery = `
        SELECT COUNT(*) as total 
        FROM media_files mf
        JOIN categories c ON mf.category_id = c.id
      `;
      queryParams.push(userId);
    }

    const conditions = [];
    
    // Category Filter (for media_files only)
    if (category && !isTV) {
      conditions.push(`c.key_name = ?`);
      queryParams.push(category);
      countParams.push(category);
    }

    // Genre Filter
    if (genre) {
      conditions.push(`${isTV ? 's' : 'mf'}.tmdb_genres LIKE ?`);
      const genrePattern = `%${genre}%`;
      queryParams.push(genrePattern);
      countParams.push(genrePattern);
    }

    // Search Filter
    if (search) {
      const searchPattern = `%${search}%`;
      if (isTV) {
        conditions.push(`s.name LIKE ?`);
        queryParams.push(searchPattern);
        countParams.push(searchPattern);
      } else {
        conditions.push(`(mf.title LIKE ? OR mf.filename LIKE ?)`);
        queryParams.push(searchPattern, searchPattern);
        countParams.push(searchPattern, searchPattern);
      }
    }

    // Append conditions to queries
    if (conditions.length > 0) {
      const whereClause = ` WHERE ` + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    // Sorting - Restricted to prevent SQL injection
    const allowedSortFields = ['created_at', 'title', 'name', 'tmdb_rating', 'updated_at'];
    const safeSort = allowedSortFields.includes(sort) ? sort : (isTV ? 'name' : 'created_at');
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${isTV ? 's.' : 'mf.'}${safeSort} ${safeOrder}`;

    // Pagination
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), parseInt(offset));

    // Execute queries
    const [rows, countResult] = await Promise.all([
      db.all(query, queryParams),
      db.get(countQuery, countParams)
    ]);

    return {
      items: rows,
      total: countResult.total,
      page: Math.floor(offset / limit) + 1,
      limit: parseInt(limit),
      totalPages: Math.ceil(countResult.total / limit)
    };
  }
}

module.exports = QueryBuilder;
