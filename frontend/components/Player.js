'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Heart, Music, ChevronLeft, ChevronRight, Play, Maximize, Minimize, Volume2, VolumeX, Pause, SkipBack, SkipForward } from 'lucide-react';
import { imageUrl, saveProgress, getProgress, toggleFavorite, getStreamMode, hlsUrl as getHlsUrl, streamUrl, API_BASE, getToken } from '@/lib/api';
import styles from './Player.module.css';

// Sub-components
import { ProgressBar } from './Player/ProgressBar';
import { Controls } from './Player/Controls';
import { VideoElement } from './Player/VideoElement';
import TranscodeQueue from './TranscodeQueue';

// Hooks
import { usePlayerShortcuts } from '@/hooks/usePlayer/usePlayerShortcuts';

export default function Player({ file, onClose, onNext, onPrev, nextEpisode, onPlayNext }) {
  const mediaRef = useRef(null);
  const id = file?.id;

  // OS Detection
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    const checkIOS = () => {
      const isStandardIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isIPadOS = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return isStandardIOS || isIPadOS;
    };
    setIsIOS(checkIOS());
  }, []);

  const needsTranscode = file?.type === 'video' && 
    ['.mkv', '.avi', '.wmv', '.flv'].some(ext => file.path?.toLowerCase().endsWith(ext));

  // States
  const [startTime, setStartTime] = useState(0); 
  const [initialTime, setInitialTime] = useState(0); 
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(file?.duration || 0);
  const [isFavorite, setIsFavorite] = useState(file?.is_favorite || false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPaused, setIsPaused] = useState(true);
  
  const [playbackError, setPlaybackError] = useState(null);
  
  // Set default stream mode to avoid null-render
  const [streamMode, setStreamMode] = useState(null); // Wait for fetchMode to confirm mode
  const [hlsSource, setHlsSource] = useState(null);
  const [transcodePercent, setTranscodePercent] = useState(null);
  const [hlsPercent, setHlsPercent] = useState(null);
  const [isGeneratingHLS, setIsGeneratingHLS] = useState(false);

  // Refs for logic
  const controlsTimeout = useRef(null);
  const progressInterval = useRef(null);
  const containerRef = useRef(null);
  const transcodePollingRef = useRef(null);
  const progressLoadedRef = useRef(false);
  const timeRef = useRef(0);
  const hasSetInitialTime = useRef(false);
  const lastSavedTime = useRef(0);
  const hlsSourceRef = useRef(null);

  // 1. Reset and Load
  useEffect(() => {
    if (!id || file.type !== 'video') return;
    
    // Reset internal flags
    progressLoadedRef.current = false;
    timeRef.current = 0;
    hasSetInitialTime.current = false;
    lastSavedTime.current = 0;
    hlsSourceRef.current = null;
    setPlaybackError(null);

    // Fetch Mode
    const fetchMode = async () => {
      try {
        const data = await getStreamMode(id);
        setStreamMode(data.mode);
        if (data.hlsExists) {
          const url = `${getHlsUrl(id)}&t=${Date.now()}`;
          setHlsSource(url);
          hlsSourceRef.current = url;
        }
        setIsGeneratingHLS(data.isGeneratingHLS);
        setHlsPercent(data.hlsPercent);
        setTranscodePercent(data.isTranscoding ? data.transcodePercent : null);
      } catch {
        setStreamMode(needsTranscode ? 'live' : 'native');
      }
    };
    fetchMode();

    // Polling
    transcodePollingRef.current = setInterval(async () => {
      try {
        const data = await getStreamMode(id);
        if (data.hlsExists && !hlsSourceRef.current) {
          const url = `${getHlsUrl(id)}&t=${Date.now()}`;
          setHlsSource(url);
          hlsSourceRef.current = url;
        }
        setIsGeneratingHLS(data.isGeneratingHLS);
        setHlsPercent(data.hlsPercent);
        if (data.mode === 'cached') setStreamMode('cached');
        if (data.isTranscoding) setTranscodePercent(data.transcodePercent);
      } catch {}
    }, 5000);

    // Fetch Progress
    getProgress(id).then(data => {
      const p = data.progress || 0;
      setInitialTime(p);
      timeRef.current = p;
      lastSavedTime.current = p;
      progressLoadedRef.current = true;
      // If we are live-transcoding, startTime IS the resume point
      if (needsTranscode && streamMode === 'live' && !hlsSourceRef.current) {
        setStartTime(p);
      }
    });

    return () => clearInterval(transcodePollingRef.current);
  }, [id, file.type]);

  // 2. Transcode logic update
  const isTranscoded = !isIOS && needsTranscode && streamMode === 'live' && !hlsSource;

  // 3. Progress Saving
  useEffect(() => {
    if (!id || file.type !== 'video') return;
    progressInterval.current = setInterval(() => {
      const current = timeRef.current;
      if (progressLoadedRef.current && current > 0 && Math.abs(current - lastSavedTime.current) >= 5) {
        saveProgress(id, current).then(() => { lastSavedTime.current = current; }).catch(() => {});
      }
    }, 10000);
    return () => clearInterval(progressInterval.current);
  }, [id, file.type]);

  // 4. Time Management
  const handleTimeUpdate = useCallback((absTime) => {
    setCurrentTime(absTime);
    timeRef.current = absTime;
  }, []);

  const handleSeek = (newTime) => {
    if (!mediaRef.current) return;
    if (isTranscoded) {
      setStartTime(newTime);
      mediaRef.current.currentTime = 0;
    } else {
      mediaRef.current.currentTime = newTime;
    }
    timeRef.current = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      const elem = containerRef.current;
      if (elem.requestFullscreen) elem.requestFullscreen();
      else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (mediaRef.current && !mediaRef.current.paused) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, []);

  usePlayerShortcuts({
    mediaRef, onClose, toggleFullscreen, onNext, onPrev,
    fileType: file.type, isTranscoded, duration, startTime,
    setStartTime, setIsPaused, timeRef, resetControlsTimeout
  });

  if (!file) return null;

  const title = file.title || (file.name || file.filename || '').replace(/\.[^/.]+$/, '');
  const isImmersive = file.type === 'image' || file.type === 'audio';

  let thumbnail = file.thumbnail;
  if (thumbnail && (thumbnail.startsWith('/images') || thumbnail.startsWith('/thumbnails') || thumbnail.startsWith('/covers'))) {
    const token = getToken();
    thumbnail = `${API_BASE}${thumbnail}${thumbnail.includes('?') ? '&' : '?'}token=${token}`;
  }

  const handleToggleFavorite = async () => {
    const res = await toggleFavorite(id);
    setIsFavorite(res.is_favorite);
  };

  return (
    <div className={`${styles.backdrop} ${!showControls ? styles.hideCursor : ''}`} onClick={onClose} onMouseMove={resetControlsTimeout}>
      <div className={`${styles.modal} ${isFullscreen || file.type === 'video' ? styles.fullscreen : ''} ${isImmersive ? styles.translucent : ''}`} onClick={(e) => e.stopPropagation()} ref={containerRef}>
        {!isImmersive && !isFullscreen && (
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h2 className={styles.title}>{title}</h2>
              {file.tmdb_genres && <span className={styles.genres}>{file.tmdb_genres}</span>}
            </div>
            <div className={styles.headerActions}>
              <button className={styles.iconBtn} onClick={handleToggleFavorite}>
                <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? styles.favorited : ''} />
              </button>
              <button className={styles.iconBtn} onClick={onClose}><X size={20} /></button>
            </div>
          </div>
        )}

        <div className={styles.content}>
          {file.type === 'video' && (
            <div className={styles.videoWrapper}>
              {!streamMode && !playbackError && (
                <div className={styles.bufferingOverlay}><div className={styles.spinner}></div></div>
              )}
              {streamMode && (
                <>
                  <VideoElement 
                ref={mediaRef} id={id}
                filePath={file.path}
                startTime={isTranscoded ? startTime : 0}
                initialTime={initialTime}
                isTranscoded={isTranscoded}
                streamMode={streamMode}
                hlsUrl={hlsSource}
                showSubtitles={showSubtitles}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={setDuration}
                onPlay={() => { resetControlsTimeout(); setIsPaused(false); }}
                onPause={() => { setShowControls(true); setIsPaused(true); }}
                onError={(err) => setPlaybackError(err)}
                isIOS={isIOS}
              />

              {playbackError && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.95)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 50,
                  color: 'white',
                  textAlign: 'center',
                  padding: '40px',
                  overflowY: 'auto'
                }}>
                  <div style={{ maxWidth: '600px', width: '100%' }}>
                    <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>Playback Error</h2>
                    <p style={{ fontSize: '1.1rem', marginBottom: '24px' }}>{playbackError}</p>
                    
                    <div style={{ marginBottom: '32px', textAlign: 'left' }}>
                      <TranscodeQueue />
                    </div>

                    <button 
                      onClick={() => setPlaybackError(null)}
                      style={{
                        padding: '10px 24px',
                        background: 'white',
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {isBuffering && transcodePercent === null && hlsPercent === null && (
                <div className={styles.bufferingOverlay}><div className={styles.spinner}></div></div>
              )}

              {!(isIOS && streamMode === 'live' && !hlsSource) && (
                <Controls 
                  onClose={onClose} isMuted={isMuted} setIsMuted={setIsMuted} volume={volume} setVolume={setVolume}
                  onSkipBack={() => handleSeek(Math.max(0, currentTime - 10))}
                  onSkipForward={() => handleSeek(Math.min(duration, currentTime + 10))}
                  isPaused={isPaused}
                  onTogglePlay={() => { 
                    if (!mediaRef.current) return;
                    if (mediaRef.current.paused) {
                      mediaRef.current.play().catch(err => {
                        console.error('[Player] Playback failed:', err);
                        
                        let customMsg = 'Playback failed: ' + err.message;
                        
                        if (err.name === 'NotSupportedError') {
                          if (streamMode === 'cached') {
                            customMsg = 'The transcoded file exists but your browser failed to play it. This might be a codec issue or a corrupted cache.';
                          } else if (streamMode === 'live') {
                            customMsg = 'Live transcoding failed or is not supported by your browser. Please wait for the background HLS process to complete.';
                          } else {
                            customMsg = `Your browser does not support this format (${file.path?.split('.').pop()?.toUpperCase() || 'MKV'}) natively. Please wait for HLS transcoding.`;
                          }
                        }
                        
                        setPlaybackError(customMsg);
                      });
                    } else {
                      mediaRef.current.pause();
                    }
                  }}
                  showSubtitles={showSubtitles} setShowSubtitles={setShowSubtitles} showControls={showControls}
                  isFullscreen={isFullscreen} toggleFullscreen={toggleFullscreen}
                  isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite}
                >
                  <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} mediaId={id} />
                </Controls>
              )}
                </>
              )}
            </div>
          )}

          {file.type === 'image' && (
            <div className={styles.imageContainer}>
              <div className={`${styles.topRightControls} ${!showControls ? styles.hidden : ''}`}>
                <button className={styles.controlBtn} onClick={handleToggleFavorite}>
                  <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? styles.favorited : ''} />
                </button>
                <button className={styles.controlBtn} onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                </button>
                <button className={styles.controlBtn} onClick={onClose}>
                  <X size={24} />
                </button>
              </div>

              <img 
                src={imageUrl(id)} 
                alt={title} 
                className={styles.imageViewer} 
                onClick={(e) => e.stopPropagation()}
              />
              {onPrev && (
                <button className={`${styles.navBtn} ${styles.prevBtn}`} onClick={(e) => { e.stopPropagation(); onPrev(); }}>
                  <ChevronLeft size={32} />
                </button>
              )}
              {onNext && (
                <button className={`${styles.navBtn} ${styles.nextBtn}`} onClick={(e) => { e.stopPropagation(); onNext(); }}>
                  <ChevronRight size={32} />
                </button>
              )}
            </div>
          )}

          {file.type === 'audio' && (
            <div className={styles.audioContainer}>
              <div className={`${styles.topRightControls} ${!showControls ? styles.hidden : ''}`}>
                <button className={styles.controlBtn} onClick={handleToggleFavorite}>
                  <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? styles.favorited : ''} />
                </button>
                <button className={styles.controlBtn} onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                </button>
                <button className={styles.controlBtn} onClick={onClose}>
                  <X size={24} />
                </button>
              </div>

              <div className={styles.ambientGlow} />
              <div className={styles.albumArt}>
                {thumbnail ? (
                  <img src={thumbnail} alt={title} />
                ) : (
                  <div className={styles.albumFallback}>
                    <Music size={80} />
                  </div>
                )}
              </div>
              
              <div className={styles.audioHUD}>
                <h2 className={styles.audioTitle}>{title}</h2>
                <p className={styles.audioSubtitle}>{file.artist || 'Unknown Artist'}</p>
              </div>

              <audio 
                ref={mediaRef}
                src={streamUrl(id)}
                autoPlay
                onTimeUpdate={(e) => handleTimeUpdate(e.target.currentTime)}
                onDurationChange={(e) => setDuration(e.target.duration)}
                onPlay={() => setIsPaused(false)}
                onPause={() => setIsPaused(true)}
              />

              <div className={styles.audioCustomControls}>
                <ProgressBar currentTime={currentTime} duration={duration} onSeek={handleSeek} />
                <div className={styles.audioMainRow}>
                  <button className={styles.audioSecondaryBtn} onClick={() => handleSeek(Math.max(0, currentTime - 10))}>
                    <SkipBack size={24} />
                  </button>
                  
                  <button className={styles.audioPlayBtn} onClick={() => {
                    if (!mediaRef.current) return;
                    if (mediaRef.current.paused) mediaRef.current.play();
                    else mediaRef.current.pause();
                  }}>
                    {isPaused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}
                  </button>
                  
                  <button className={styles.audioSecondaryBtn} onClick={() => handleSeek(Math.min(duration, currentTime + 10))}>
                    <SkipForward size={24} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
