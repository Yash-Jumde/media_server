'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, fetchFavorites } from '@/lib/api';
import { useSearch } from '@/lib/SearchContext';
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

  const { searchQuery } = useSearch();

  const filteredItems = files.filter((f) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      (f.title || '').toLowerCase().includes(query) ||
      (f.name || '').toLowerCase().includes(query) ||
      (f.filename || '').toLowerCase().includes(query)
    );
  });

  const handleClosePlayer = () => {
    setActiveFile(null);
    loadFavorites(); // Refresh in case favorite was toggled
  };

  return (
    <Shell>
      <div className={styles.content}>
        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${styles.skeletonCard} skeleton`} />
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredItems.map((f, i) => (
              <MediaCard key={i} file={{...f, is_favorite: true}} onClick={setActiveFile} />
            ))}
            {filteredItems.length === 0 && <p className={styles.empty}>No matching favorites found.</p>}
          </div>
        )}
      </div>
      {activeFile && <Player file={activeFile} onClose={handleClosePlayer} />}
    </Shell>
  );
}
