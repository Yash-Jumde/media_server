'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { fetchRecommendations, API_BASE, getToken } from '@/lib/api';
import styles from './MediaDetail.module.css';

export default function Recommendations({ itemId, onItemClick }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecs() {
      if (!itemId) return;
      setLoading(true);
      try {
        const data = await fetchRecommendations(itemId);
        setRecommendations(data);
      } catch (err) {
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRecs();
  }, [itemId]);

  if (loading) return null;
  if (recommendations.length === 0) return null;

  return (
    <div className={styles.recommendationsSection}>
      <h2 className={styles.sectionTitle}>More Like This</h2>
      <div className={styles.recommendationsGrid}>
        {recommendations.map((rec) => {
          let posterUrl = rec.tmdb_poster_url || rec.thumbnail;
          if (posterUrl && (posterUrl.startsWith('/images') || posterUrl.startsWith('/thumbnails'))) {
            const token = getToken();
            posterUrl = `${API_BASE}${posterUrl}${posterUrl.includes('?') ? '&' : '?'}token=${token}`;
          }

          return (
            <div 
              key={rec.id} 
              className={styles.recommendationCard}
              onClick={() => onItemClick(rec)}
            >
              <img src={posterUrl} alt={rec.title || rec.name} className={styles.recommendationPoster} />
              <div className={styles.recommendationOverlay}>
                <div className={styles.recTitle}>{rec.title || rec.name}</div>
                {(rec.tmdb_rating > 0) && (
                  <div className={styles.recRating}>
                    <Star size={12} fill="currentColor" />
                    <span>{rec.tmdb_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
