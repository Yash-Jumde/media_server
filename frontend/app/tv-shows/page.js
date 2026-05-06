'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, fetchMedia } from '@/lib/api';
import { useSearch } from '@/lib/SearchContext';
import Shell from '@/components/Shell';
import MediaCard from '@/components/MediaCard';
import MediaDetail from '@/components/MediaDetail';
import Player from '@/components/Player';
import { Tv, Loader2 } from 'lucide-react';
import styles from '../page.module.css';

export default function TvShowsPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [detailItem, setDetailItem] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const observer = useRef();

  const loadTVShows = async (pageNum, isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setIsFetching(true);
      
      const data = await fetchMedia('tv_shows', pageNum, 20);
      
      if (isInitial) {
        setItems(data.items || []);
      } else {
        setItems(prev => [...prev, ...(data.items || [])]);
      }
      
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    loadTVShows(1, true);
  }, []);

  const lastElementRef = useCallback(node => {
    if (loading || isFetching) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && page < totalPages) {
        setPage(prevPage => {
          const nextPage = prevPage + 1;
          loadTVShows(nextPage);
          return nextPage;
        });
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, isFetching, page, totalPages]);

  const { searchQuery } = useSearch();

  const filteredItems = items.filter((f) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      (f.title || '').toLowerCase().includes(query) ||
      (f.name || '').toLowerCase().includes(query)
    );
  });

  const handlePlay = (file, startTime = 0) => {
    setActiveFile({ ...file, initialTime: startTime });
    setDetailItem(null);
  };

  return (
    <Shell>
      <div className={styles.content}>
        <div className={styles.sectionHeader}>
          <h1 className={styles.pageTitle}>
            <Tv size={28} className={styles.titleIcon} />
            TV Shows
          </h1>
        </div>

        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${styles.skeletonCard} skeleton`} />
            ))}
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {filteredItems.map((f, i) => {
                if (filteredItems.length === i + 1) {
                  return <MediaCard ref={lastElementRef} key={f.id || i} file={f} onClick={setDetailItem} />;
                } else {
                  return <MediaCard key={f.id || i} file={f} onClick={setDetailItem} />;
                }
              })}
            </div>
            
            {isFetching && (
              <div className={styles.loaderContainer}>
                <Loader2 className={styles.spinner} />
              </div>
            )}
            
            {filteredItems.length === 0 && !isFetching && (
              <p className={styles.empty}>No matching TV shows found.</p>
            )}
          </>
        )}
      </div>
      {detailItem && (
        <MediaDetail 
          item={detailItem} 
          onClose={() => setDetailItem(null)} 
          onPlay={handlePlay}
          onItemClick={setDetailItem}
        />
      )}
      {activeFile && <Player file={activeFile} onClose={() => setActiveFile(null)} />}
    </Shell>
  );
}
