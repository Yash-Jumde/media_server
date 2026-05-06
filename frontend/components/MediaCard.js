'use client';

import { useState, forwardRef } from 'react';
import { Film, Music, Image as ImageIcon, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatFileSize, getToken, API_BASE } from '@/lib/api';
import styles from './MediaCard.module.css';

const typeIcons = {
  video: Film,
  audio: Music,
  image: ImageIcon,
};

const MediaCard = forwardRef(({ file, onClick }, ref) => {
  const router = useRouter();
  const Icon = typeIcons[file.type] || Film;
  
  const handleClick = () => {
    if (file.type === 'video' || file.type === 'tv_series' || file.type === 'series') {
      router.push(`/media/${file.id}`);
    } else {
      onClick?.(file);
    }
  };

  let posterUrl = file.tmdb_poster_url || file.thumbnail;
  if (posterUrl && (posterUrl.startsWith('/images') || posterUrl.startsWith('/thumbnails') || posterUrl.startsWith('/covers'))) {
    const token = getToken();
    posterUrl = `${API_BASE}${posterUrl}${posterUrl.includes('?') ? '&' : '?'}token=${token}`;
  }

  const [imgError, setImgError] = useState(false);

  const title = file.title || file.name?.replace(/\.[^/.]+$/, '');
  const isSquare = file.type === 'image' || file.type === 'audio' || file.category === 'images' || file.category === 'photos' || file.category === 'audio';

  return (
    <div ref={ref} className={`${styles.card} ${isSquare ? styles.squareCard : ''}`} onClick={handleClick}>
      <div className={styles.poster}>
        {posterUrl && !imgError ? (
          <img
            src={posterUrl}
            alt={title}
            className={styles.posterImage}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`${styles.posterFallback} ${file.type === 'audio' ? styles.audioFallback : ''}`}>
            <Icon size={32} />
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
});

MediaCard.displayName = 'MediaCard';

export default MediaCard;
