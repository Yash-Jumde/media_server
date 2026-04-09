'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, fetchMedia, fetchRecent } from '@/lib/api';
import Shell from '@/components/Shell';
import MediaCard from '@/components/MediaCard';
import Player from '@/components/Player';
import { Clock, TrendingUp, Search } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [categories, setCategories] = useState({});
  const [recent, setRecent] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      setRecent(recentData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const allFiles = Object.values(categories).flatMap((cat) => cat.files || []);
  const filtered = search
    ? allFiles.filter((f) =>
      (f.name || f.filename || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.title || '').toLowerCase().includes(search.toLowerCase())
    )
    : null;

  return (
    <Shell>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>Welcome back</h1>
          {/* <p className={styles.subtitle}>Your personal media library</p> */}
        </div>
        <div className={styles.searchWrap}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search your library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </header>

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
                <MediaCard key={i} file={f} onClick={setActiveFile} />
              ))}
              {filtered.length === 0 && (
                <p className={styles.empty}>No results found.</p>
              )}
            </div>
          </>
        ) : (
          <>
            {recent.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <Clock size={20} />
                  Continue Watching
                </h2>
                <div className={styles.row}>
                  {recent.slice(0, 10).map((f, i) => (
                    <MediaCard key={i} file={f} onClick={setActiveFile} />
                  ))}
                </div>
              </section>
            )}

            {Object.entries(categories).map(([key, cat]) => {
              if (!cat.files || cat.files.length === 0) return null;
              return (
                <section key={key} className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    <TrendingUp size={20} />
                    {cat.name}
                  </h2>
                  <div className={styles.row}>
                    {cat.files.slice(0, 12).map((f, i) => (
                      <MediaCard key={i} file={f} onClick={setActiveFile} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>

      {activeFile && (
        <Player file={activeFile} onClose={() => setActiveFile(null)} />
      )}
    </Shell>
  );
}
