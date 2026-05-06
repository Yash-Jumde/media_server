'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { fetchMediaById, fetchNextEpisode } from '@/lib/api';
import Player from '@/components/Player';

export default function WatchPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [file, setFile] = useState(null);
  const [nextEpisode, setNextEpisode] = useState(null);
  const [loading, setLoading] = useState(true);

  const startParam = searchParams.get('start');
  const initialTime = startParam ? parseFloat(startParam) : undefined;

  useEffect(() => {
    async function loadMedia() {
      try {
        const data = await fetchMediaById(id);
        // Inject initialTime from query param if present
        if (initialTime !== undefined) {
          data.initialTime = initialTime;
        }
        setFile(data);

        // Fetch next episode if this is a TV series episode
        if (data.series_id) {
          const nextEp = await fetchNextEpisode(id);
          setNextEpisode(nextEp);
        }
      } catch (err) {
        console.error('Error loading media for player:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMedia();
  }, [id, initialTime]);

  const handleClose = () => {
    if (window.history.length > 2) {
      router.back();
    } else if (file && file.series_name) {
      router.replace(`/media/${encodeURIComponent(file.series_name)}`);
    } else {
      router.replace(`/media/${id}`);
    }
  };

  if (loading) return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Loading player...</div>;
  if (!file) return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Media not found</div>;

  const handlePlayNext = () => {
    if (nextEpisode) {
      router.replace(`/watch/${nextEpisode.id}`);
    }
  };

  return (
    <div style={{ background: '#000', height: '100vh' }}>
      <Player 
        file={file} 
        onClose={handleClose} 
        nextEpisode={nextEpisode}
        onPlayNext={handlePlayNext}
      />
    </div>
  );
}
