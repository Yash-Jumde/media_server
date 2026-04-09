'use client';

import { Film, Music, Image as ImageIcon, Star } from 'lucide-react';
import { formatFileSize, getToken } from '@/lib/api';
import styles from './MediaCard.module.css';

const typeIcons = {
  video: Film,
  audio: Music,
  image: ImageIcon,
};

export default function MediaCard({ file, onClick }) {
  const Icon = typeIcons[file.type] || Film;
  
  let posterUrl = file.tmdb_poster_url || file.thumbnail;
  if (posterUrl && (posterUrl.startsWith('/images') || posterUrl.startsWith('/thumbnails'))) {
    const token = getToken();
    posterUrl = `${posterUrl}?token=${token}`;
  }

  const title = file.title || file.name?.replace(/\.[^/.]+$/, '');

  return (
    <div className={styles.card} onClick={() => onClick?.(file)}>
      <div className={styles.poster}>
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className={styles.posterImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.posterFallback}>
            <Icon size={32} />
          </div>
        )}
        {file.type !== 'image' && (
          <div className={styles.overlay}>
            <div className={styles.playBtn}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}
        <span className={styles.badge}>{file.type}</span>
        {file.tmdb_rating > 0 && (
          <span className={styles.rating}>
            <Star size={10} />
            {file.tmdb_rating.toFixed(1)}
          </span>
        )}
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.meta}>
          {file.tmdb_genres || formatFileSize(file.size || file.file_size)}
        </p>
      </div>
    </div>
  );
}
