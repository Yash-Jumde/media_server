'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, fetchMedia } from '@/lib/api';
import Shell from '@/components/Shell';
import MediaCard from '@/components/MediaCard';
import Player from '@/components/Player';
import { Tv, ChevronLeft } from 'lucide-react';
import styles from '../page.module.css';
import tvStyles from './tv.module.css';

export default function TvShowsPage() {
  const router = useRouter();
  const [series, setSeries] = useState({});
  const [activeFile, setActiveFile] = useState(null);
  const [activeSeries, setActiveSeries] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    fetchMedia().then((data) => {
      setSeries(data.tv_shows?.series || {});
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (activeSeries) {
    const s = series[activeSeries];
    return (
      <Shell>
        <header className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className={tvStyles.backBtn} onClick={() => setActiveSeries(null)}>
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className={styles.greeting}>{activeSeries}</h1>
              <p className={styles.subtitle}>{s?.episodes?.length || 0} episodes</p>
            </div>
          </div>
        </header>
        <div className={styles.content}>
          <div className={styles.grid}>
            {(s?.episodes || []).map((ep, i) => (
              <MediaCard key={i} file={ep} onClick={setActiveFile} />
            ))}
          </div>
        </div>
        {activeFile && <Player file={activeFile} onClose={() => setActiveFile(null)} />}
      </Shell>
    );
  }

  const seriesNames = Object.keys(series);

  return (
    <Shell>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>TV Shows</h1>
          <p className={styles.subtitle}>{seriesNames.length} series in your library</p>
        </div>
      </header>
      <div className={styles.content}>
        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${styles.skeletonCard} skeleton`} />
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {seriesNames.map((name) => {
              const s = series[name];
              const firstEp = s.episodes?.[0];
              return (
                <div
                  key={name}
                  className={tvStyles.seriesCard}
                  onClick={() => setActiveSeries(name)}
                >
                  <div className={tvStyles.seriesPoster}>
                    <Tv size={32} />
                  </div>
                  <div className={tvStyles.seriesInfo}>
                    <h3>{name}</h3>
                    <p>{s.episodes?.length || 0} episodes</p>
                  </div>
                </div>
              );
            })}
            {seriesNames.length === 0 && <p className={styles.empty}>No TV shows found.</p>}
          </div>
        )}
      </div>
    </Shell>
  );
}
