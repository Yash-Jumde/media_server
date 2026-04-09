'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Heart, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react';
import { streamUrl, imageUrl, subtitleUrl, saveProgress, getProgress, toggleFavorite } from '@/lib/api';
import styles from './Player.module.css';

export default function Player({ file, onClose }) {
  const mediaRef = useRef(null);
  const [isFavorite, setIsFavorite] = useState(file?.is_favorite || false);
  const progressInterval = useRef(null);

  const handleFavorite = async () => {
    if (!file) return;
    try {
      const res = await toggleFavorite(file.id);
      setIsFavorite(res.is_favorite);
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-resume from saved progress
  useEffect(() => {
    if (!file || file.type === 'image') return;
    const id = file.id;

    getProgress(id).then((data) => {
      if (data.progress > 0 && mediaRef.current) {
        mediaRef.current.currentTime = data.progress;
      }
    });

    // Save progress every 10 seconds
    progressInterval.current = setInterval(() => {
      if (mediaRef.current && !mediaRef.current.paused) {
        saveProgress(id, mediaRef.current.currentTime).catch(() => {});
      }
    }, 10000);

    return () => {
      // Save progress on unmount
      if (mediaRef.current) {
        saveProgress(id, mediaRef.current.currentTime).catch(() => {});
      }
      clearInterval(progressInterval.current);
    };
  }, [file]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e) => {
      if (!mediaRef.current) return;
      switch (e.key.toLowerCase()) {
        case 'escape': onClose(); break;
        case ' ':
          e.preventDefault();
          mediaRef.current.paused ? mediaRef.current.play() : mediaRef.current.pause();
          break;
        case 'arrowright': mediaRef.current.currentTime += 10; break;
        case 'arrowleft': mediaRef.current.currentTime -= 10; break;
        case 'f':
          document.fullscreenElement ? document.exitFullscreen() : mediaRef.current.requestFullscreen?.();
          break;
        case 'm':
          mediaRef.current.muted = !mediaRef.current.muted;
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!file) return null;

  const id = file.id;
  const filename = file.name || file.filename || '';
  const title = file.title || filename.replace(/\.[^/.]+$/, '');

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>{title}</h2>
            {file.tmdb_genres && <span className={styles.genres}>{file.tmdb_genres}</span>}
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconBtn} onClick={handleFavorite}>
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? styles.favorited : ''} />
            </button>
            <button className={styles.iconBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {file.type === 'video' && (
            <video
              ref={mediaRef}
              className={styles.videoPlayer}
              src={streamUrl(id)}
              controls
              autoPlay
              playsInline
              webkit-playsinline="true"
              crossOrigin="anonymous"
            >
              <track
                label="English"
                kind="subtitles"
                srcLang="en"
                src={subtitleUrl(id)}
                default
              />
            </video>
          )}

          {file.type === 'audio' && (
            <div className={styles.audioContainer}>
              <div className={styles.albumArt}>
                {file.tmdb_poster_url ? (
                  <img src={file.tmdb_poster_url} alt={title} />
                ) : (
                  <div className={styles.albumFallback}>
                    <Volume2 size={64} />
                  </div>
                )}
              </div>
              <audio
                ref={mediaRef}
                className={styles.audioPlayer}
                src={streamUrl(id)}
                controls
                autoPlay
              />
            </div>
          )}

          {file.type === 'image' && (
            <div className={styles.imageContainer}>
              <img
                src={imageUrl(id)}
                alt={title}
                className={styles.imageViewer}
              />
            </div>
          )}
        </div>

        {file.tmdb_overview && (
          <div className={styles.overview}>
            <p>{file.tmdb_overview}</p>
          </div>
        )}
      </div>
    </div>
  );
}
