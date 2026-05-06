'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, fetchMedia, fetchRecent } from '@/lib/api';
import { useSearch } from '@/lib/SearchContext';
import Shell from '@/components/Shell';
import MediaCard from '@/components/MediaCard';
import MediaDetail from '@/components/MediaDetail';
import Player from '@/components/Player';
import TranscodeQueue from '@/components/TranscodeQueue';
import { Clock, TrendingUp, Film, Tv, Camera, Music } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [categories, setCategories] = useState({});
  const [recent, setRecent] = useState([]);
  const [detailItem, setDetailItem] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const { searchQuery } = useSearch();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!getToken()) {
      router.push('/login');
      return;
    }
    loadData();
  }, []);

  async function loadData() {
    try {
      const [mediaData, recentData] = await Promise.all([
        fetchMedia(),
        fetchRecent().catch(() => []),
      ]);
      setCategories(mediaData);
      setRecent(recentData.filter(f => f.type === 'video' || f.type === 'tv_series' || f.type === 'series'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const allFiles = Object.values(categories).flatMap((cat) => cat.files || []);
  const filtered = searchQuery
    ? allFiles.filter((f) =>
      (f.name || f.filename || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.title || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    : null;

  const handleCardClick = (item) => {
    const isImmersive = item.type === 'video' || item.type === 'tv_series';
    if (!isImmersive) {
      setActiveFile(item);
      window.history.pushState({ type: 'player' }, '');
    } else {
      setDetailItem(item);
      window.history.pushState({ type: 'detail' }, '');
    }
  };

  const handlePlay = (file, startTime = 0) => {
    setActiveFile({ ...file, initialTime: startTime });
    window.history.pushState({ type: 'player' }, '');
    // No longer setting setDetailItem(null) to preserve navigation
  };

  // Close handlers that also handle history back manually if needed
  const closeDetail = () => {
    setDetailItem(null);
    if (window.history.state?.type === 'detail') {
      window.history.back();
    }
  };

  const closePlayer = () => {
    setActiveFile(null);
    if (window.history.state?.type === 'player') {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = (e) => {
      // Use the incoming state to determine what should be open
      const type = e.state?.type;
      
      if (!type) {
        // Back to home
        setActiveFile(null);
        setDetailItem(null);
      } else if (type === 'detail') {
        // Back to detail from player
        setActiveFile(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // Remove dependencies to avoid stale closures in handlePopState

  if (!mounted) return null;

  return (
    <Shell>
      <div className={styles.content}>
        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${styles.skeletonCard} skeleton`} />
            ))}
          </div>
        ) : filtered ? (
          <>
            <h2 className={styles.sectionTitle}>Search Results</h2>
            <div className={styles.grid}>
              {filtered.map((f, i) => (
                <MediaCard key={i} file={f} onClick={handleCardClick} />
              ))}
              {filtered.length === 0 && (
                <p className={styles.empty}>No results found.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <TranscodeQueue />

            {recent.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <Clock size={20} className={styles.sectionIcon} />
                  Continue Watching
                </h2>
                <div className={styles.row}>
                  {recent.slice(0, 10).map((f, i) => (
                    <MediaCard key={i} file={f} onClick={handleCardClick} />
                  ))}
                </div>
              </section>
            )}

            {Object.entries(categories).map(([key, cat]) => {
              if (!cat.files || cat.files.length === 0) return null;
              return (
                <section key={key} className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    {cat.name.toLowerCase().includes('movie') ? (
                      <Film size={20} className={styles.sectionIcon} />
                    ) : cat.name.toLowerCase().includes('show') || cat.name.toLowerCase().includes('series') ? (
                      <Tv size={20} className={styles.sectionIcon} />
                    ) : cat.name.toLowerCase().includes('image') || cat.name.toLowerCase().includes('photo') ? (
                      <Camera size={20} className={styles.sectionIcon} />
                    ) : cat.name.toLowerCase().includes('audio') || cat.name.toLowerCase().includes('music') ? (
                      <Music size={20} className={styles.sectionIcon} />
                    ) : (
                      <TrendingUp size={20} className={styles.sectionIcon} />
                    )}
                    {cat.name}
                  </h2>
                  <div className={styles.row}>
                    {(() => {
                      const displayFiles = (key === 'tv_shows' && cat.series) 
                        ? Object.values(cat.series) 
                        : cat.files;
                      
                      return displayFiles.slice(0, 12).map((f, i) => (
                        <MediaCard key={i} file={f} onClick={handleCardClick} />
                      ));
                    })()}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>

      {detailItem && (
        <MediaDetail 
          item={detailItem} 
          onClose={closeDetail} 
          onPlay={handlePlay}
          onItemClick={setDetailItem}
        />
      )}

      {activeFile && (
        <Player 
          file={activeFile} 
          onClose={closePlayer} 
        />
      )}
    </Shell>
  );
}
