'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, fetchFavorites } from '@/lib/api';
import Shell from '@/components/Shell';
import MediaCard from '@/components/MediaCard';
import Player from '@/components/Player';
import styles from '../page.module.css';

export default function FavoritesPage() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const data = await fetchFavorites();
      setFiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePlayer = () => {
    setActiveFile(null);
    loadFavorites(); // Refresh in case favorite was toggled
  };

  return (
    <Shell>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>Favorites</h1>
          <p className={styles.subtitle}>{files.length} items saved</p>
        </div>
      </header>
      <div className={styles.content}>
        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${styles.skeletonCard} skeleton`} />
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {files.map((f, i) => (
              <MediaCard key={i} file={{...f, is_favorite: true}} onClick={setActiveFile} />
            ))}
            {files.length === 0 && <p className={styles.empty}>No favorites yet.</p>}
          </div>
        )}
      </div>
      {activeFile && <Player file={activeFile} onClose={handleClosePlayer} />}
    </Shell>
  );
}
