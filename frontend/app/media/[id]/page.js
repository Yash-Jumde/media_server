'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, RotateCcw, Heart, Star, Clock, Calendar, Film } from 'lucide-react';
import { fetchMediaById, fetchSeriesByName, getProgress, toggleFavorite, API_BASE, getToken } from '@/lib/api';
import Recommendations from '@/components/Recommendations';
import styles from '@/components/MediaDetail.module.css';

export default function MediaDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [resumeEpisode, setResumeEpisode] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        let data;
        if (!isNaN(id) && id.trim() !== '') {
          data = await fetchMediaById(id);
        } else {
          data = await fetchSeriesByName(id);
          data.type = 'series'; // Normalize to 'series' for component logic
          data.title = data.name; // Normalize title/name
          
          // Fetch series-level resume progress
          const resumeData = await fetch(`${API_BASE}/api/series-resume/${encodeURIComponent(id)}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
          }).then(res => res.json()).catch(() => null);
          setResumeEpisode(resumeData);
        }
        
        setItem(data);
        setIsFavorite(data.is_favorite || false);
        
        if (data.type === 'series' && data.seasons && data.seasons.length > 0) {
          setSelectedSeason(data.seasons[0].seasonNum);
        } else if (data.type !== 'series') {
          const progData = await getProgress(data.id);
          setProgress(progData.progress || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) return <div className="loading">Loading details...</div>;
  if (!item) return <div className="error">Media not found</div>;

  const handleFavorite = async () => {
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

  const handlePlay = (playItem, startTime = 0) => {
    router.push(`/watch/${playItem.id}${startTime > 0 ? `?start=${startTime}` : ''}`);
  };

  return (
    <div className={styles.pageContainer}>
      <button className={styles.backBtn} onClick={() => router.back()}>
        <ArrowLeft size={24} />
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
            {item.type !== 'series' ? (
              <>
                {progress > 0 && (
                  <button 
                    className={styles.primaryBtn} 
                    onClick={() => handlePlay(item, progress)}
                  >
                    <Play size={20} fill="currentColor" />
                    Resume at {formatTime(progress)}
                  </button>
                )}
                <button 
                  className={progress > 0 ? styles.secondaryBtn : styles.primaryBtn} 
                  onClick={() => handlePlay(item, 0)}
                >
                  {progress > 0 ? <RotateCcw size={20} /> : <Play size={20} fill="currentColor" />}
                  {progress > 0 ? 'Watch from Beginning' : 'Play'}
                </button>
              </>
            ) : (
              <div className={styles.seriesActions}>
                {resumeEpisode && (
                  <button 
                    className={styles.primaryBtn} 
                    onClick={() => handlePlay(resumeEpisode, resumeEpisode.progress || 0)}
                  >
                    <Play size={20} fill="currentColor" />
                    Resume {resumeEpisode.name || resumeEpisode.title || 'Episode'} at {formatTime(resumeEpisode.progress)}
                  </button>
                )}
                <button 
                  className={resumeEpisode ? styles.secondaryBtn : styles.primaryBtn}
                  onClick={() => {
                    const firstEp = item.episodes?.[0];
                    if (firstEp) handlePlay(firstEp, 0);
                  }}
                >
                  {resumeEpisode ? <RotateCcw size={20} /> : <Play size={20} fill="currentColor" />}
                  {resumeEpisode ? 'Start from Beginning' : 'Play First Episode'}
                </button>
              </div>
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

        {/* Series Layout: Seasons Sidebar & Episodes Content */}
        {item.type === 'series' && item.seasons && (
          <div className={styles.seriesContainer}>
            <div className={styles.seasonsSidebar}>
              <h3 className={styles.sidebarTitle}>Seasons</h3>
              <div className={styles.seasonList}>
                {item.seasons.map((season) => (
                  <button
                    key={season.seasonNum}
                    className={`${styles.seasonBtn} ${selectedSeason === season.seasonNum ? styles.activeSeason : ''}`}
                    onClick={() => setSelectedSeason(season.seasonNum)}
                  >
                    Season {season.seasonNum}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={styles.episodesContent}>
              <h2 className={styles.sectionTitle}>Episodes</h2>
              <div className={styles.episodeList}>
                {item.seasons.find(s => s.seasonNum === selectedSeason)?.episodes.map((ep, i) => (
                  <div key={i} className={styles.episodeRow} onClick={() => handlePlay(ep, 0)}>
                    <div className={styles.epNumber}>{ep.episodeNum || i + 1}</div>
                    <div className={styles.epPoster}>
                       {ep.tmdb_poster_url || ep.thumbnail ? (
                         <img src={ep.tmdb_poster_url || ep.thumbnail} alt={ep.title || ep.name} />
                       ) : <Film size={20} />}
                    </div>
                    <div className={styles.epInfo}>
                      <div className={styles.epTitle}>{ep.title || ep.name?.replace(/\.[^/.]+$/, '')}</div>
                      {ep.tmdb_overview && <div className={styles.epOverview}>{ep.tmdb_overview}</div>}
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
          </div>
        )}
      </div>

      <Recommendations itemId={item.id} onItemClick={(rec) => router.push(`/media/${rec.id}`)} />
    </div>
  );
}
