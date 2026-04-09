'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, fetchMedia } from '@/lib/api';
import Shell from '@/components/Shell';
import MediaCard from '@/components/MediaCard';
import Player from '@/components/Player';
import styles from '../page.module.css';

export default function ImagesPage() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    fetchMedia().then((data) => {
      setFiles(data.images?.files || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>Images</h1>
          <p className={styles.subtitle}>{files.length} images in your library</p>
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
              <MediaCard key={i} file={f} onClick={setActiveFile} />
            ))}
            {files.length === 0 && <p className={styles.empty}>No images found.</p>}
          </div>
        )}
      </div>
      {activeFile && <Player file={activeFile} onClose={() => setActiveFile(null)} />}
    </Shell>
  );
}
