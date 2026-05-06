'use client';

import { useState, useEffect } from 'react';
import { X, Play, RotateCcw, Heart, Star, Clock, Calendar, Film, ChevronLeft } from 'lucide-react';
import { getProgress, toggleFavorite, API_BASE, getToken } from '@/lib/api';
import Recommendations from './Recommendations';
import styles from './MediaDetail.module.css';

export default function MediaDetail({ item, onClose, onPlay, onItemClick }) {
  const [progress, setProgress] = useState(0);
  const [isFavorite, setIsFavorite] = useState(item?.is_favorite || false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    
    if (item && item.type !== 'series' && item.type !== 'tv_series') {
      getProgress(item.id).then(data => setProgress(data.progress || 0));
    }
    
    return () => clearTimeout(timer);
  }, [item]);

  if (!item) return null;

  const handleFavorite = async (e) => {
    e.stopPropagation();
    try {
      const res = await toggleFavorite(item.id);
      setIsFavorite(res.is_favorite);
    } catch (err) {
      console.error(err);
    }
  };

  const title = item.title || item.name?.replace(/\.[^/.]+$/, '');
  
  let backdropUrl = item.tmdb_backdrop_url || item.tmdb_poster_url || item.thumbnail;
  if (backdropUrl && (backdropUrl.startsWith('/images') || backdropUrl.startsWith('/thumbnails'))) {
    const token = getToken();
    backdropUrl = `${API_BASE}${backdropUrl}${backdropUrl.includes('?') ? '&' : '?'}token=${token}`;
  }

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  return (
    <div className={`${styles.overlay} ${isVisible ? styles.visible : ''}`} onClick={onClose}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        <button className={styles.backBtn} onClick={onClose}>
          <ChevronLeft size={24} />
          <span>Back</span>
        </button>

        <div className={styles.hero}>
          <div className={styles.backdropWrapper}>
            <img src={backdropUrl} alt={title} className={styles.backdrop} />
            <div className={styles.backdropOverlay} />
          </div>

          <div className={styles.heroContent}>
            <h1 className={styles.title}>{title}</h1>
            
            <div className={styles.metaRow}>
              {item.tmdb_rating > 0 && (
                <div className={styles.rating}>
                  <Star size={16} fill="currentColor" />
                  <span>{(item.tmdb_rating || 0).toFixed(1)}</span>
                </div>
              )}
              {item.tmdb_release_date && (
                <div className={styles.metaItem}>
                  <Calendar size={16} />
                  <span>{new Date(item.tmdb_release_date).getFullYear()}</span>
                </div>
              )}
              {item.duration && (
                <div className={styles.metaItem}>
                  <Clock size={16} />
                  <span>{formatTime(item.duration)}</span>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              {(item.type !== 'series' && item.type !== 'tv_series') ? (
                <>
                  {progress > 0 && (
                    <button 
                      className={styles.primaryBtn} 
                      onClick={() => onPlay(item, progress)}
                    >
                      <Play size={20} fill="currentColor" />
                      Resume at {formatTime(progress)}
                    </button>
                  )}
                  <button 
                    className={progress > 0 ? styles.secondaryBtn : styles.primaryBtn} 
                    onClick={() => onPlay(item, 0)}
                  >
                    {progress > 0 ? <RotateCcw size={20} /> : <Play size={20} fill="currentColor" />}
                    {progress > 0 ? 'Watch from Beginning' : 'Play'}
                  </button>
                </>
              ) : (
                <p className={styles.instruction}>Select an episode to start watching</p>
              )}
              
              <button 
                className={`${styles.iconBtn} ${isFavorite ? styles.favorited : ''}`} 
                onClick={handleFavorite}
              >
                <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.details}>
          <div className={styles.mainInfo}>
            <p className={styles.description}>{item.tmdb_overview || 'No description available for this title.'}</p>
            
            {item.tmdb_genres && (
              <div className={styles.tags}>
                {item.tmdb_genres.split(',').map(tag => (
                  <span key={tag} className={styles.tag}>{tag.trim()}</span>
                ))}
              </div>
            )}
          </div>

          {(item.type === 'series' || item.type === 'tv_series') && (
            <div className={styles.episodesSection}>
              <h2 className={styles.sectionTitle}>Episodes</h2>
              <div className={styles.episodeList}>
                {(item.episodes || []).map((ep, i) => (
                  <div key={i} className={styles.episodeRow} onClick={() => onPlay(ep, 0)}>
                    <div className={styles.epNumber}>{i + 1}</div>
                    <div className={styles.epPoster}>
                       {ep.tmdb_poster_url || ep.thumbnail ? (
                         <img src={ep.tmdb_poster_url || ep.thumbnail} alt={ep.title || ep.name} />
                       ) : <Film size={20} />}
                    </div>
                    <div className={styles.epInfo}>
                      <div className={styles.epTitle}>{ep.title || ep.name?.replace(/\.[^/.]+$/, '')}</div>
                      <div className={styles.epMeta}>
                        {ep.duration && formatTime(ep.duration)}
                      </div>
                    </div>
                    <button className={styles.epPlayBtn}>
                      <Play size={16} fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Recommendations itemId={item.id} onItemClick={onItemClick} />
      </div>
    </div>
  );
}
