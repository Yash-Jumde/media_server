import { forwardRef, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { streamUrl, subtitleUrl, getToken } from '@/lib/api';
import styles from '../Player.module.css';

/**
 * Checks if the browser can play a specific file type.
 * MKV files are mapped to video/x-matroska.
 */
const checkSupport = (filePath) => {
  if (typeof window === 'undefined' || !filePath) return { supported: true };
  const video = document.createElement('video');
  const ext = filePath.split('.').pop().toLowerCase();
  
  if (ext === 'mkv') {
    const canPlay = video.canPlayType('video/x-matroska');
    return {
      supported: canPlay !== '',
      message: 'MKV playback is not natively supported by your browser.'
    };
  }
  
  return { supported: true };
};

export const VideoElement = forwardRef(({
  id,
  filePath,
  startTime,
  initialTime,
  isTranscoded,
  streamMode,
  hlsUrl: hlsSource,
  showSubtitles,
  onTimeUpdate,
  onDurationChange,
  onPlay,
  onPause,
  onError: onPlayerError,
  isIOS
}, ref) => {
  const hlsRef = useRef(null);
  const hasSeekedInitial = useRef(false);
  const [browserError, setBrowserError] = useState(null);

  // Check support
  useEffect(() => {
    // Only check native support if we are actually trying to play the original file ('native' mode).
    // If we are in 'cached' or 'live' mode, we are playing an MP4 stream, so the original extension doesn't matter.
    const shouldCheckSupport = streamMode === 'native';
    
    if (filePath && shouldCheckSupport) {
      const support = checkSupport(filePath);
      if (!support.supported) {
        setBrowserError(support.message);
        if (onPlayerError) onPlayerError(support.message);
      } else {
        setBrowserError(null);
        if (onPlayerError) onPlayerError(null); // Clear parent error if resolved
      }
    } else {
      setBrowserError(null);
      // We only clear parent error if it was a "Format Not Supported" error we set earlier
      if (browserError && onPlayerError) onPlayerError(null);
    }
  }, [filePath, hlsSource, isTranscoded, streamMode, onPlayerError, browserError]);

  // Reset seek flag when ID changes
  useEffect(() => {
    hasSeekedInitial.current = false;
  }, [id]);

  // 1. HLS Management
  useEffect(() => {
    const video = ref.current;
    if (!video || !hlsSource || isIOS) return;

    if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr, url) => {
          const token = getToken();
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
      });

      hls.loadSource(hlsSource);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (initialTime > 0 && !hasSeekedInitial.current) {
          video.currentTime = initialTime;
          hasSeekedInitial.current = true;
          console.log(`[HLS] Seeked to ${initialTime}s`);
        }
      });

      return () => {
        if (hlsRef.current) hlsRef.current.destroy();
      };
    }
  }, [hlsSource, isIOS, ref]);

  // 2. Native Seek Management
  useEffect(() => {
    const video = ref.current;
    // Don't seek if we are live-transcoding (server does it) or if already seeked
    if (!video || initialTime === 0 || isTranscoded || hasSeekedInitial.current) return;

    const onMetadata = () => {
      if (!hasSeekedInitial.current) {
        video.currentTime = initialTime;
        hasSeekedInitial.current = true;
        console.log(`[Native] Seeked to ${initialTime}s`);
      }
    };

    if (video.readyState >= 1) {
      onMetadata();
    } else {
      video.addEventListener('loadedmetadata', onMetadata);
      return () => video.removeEventListener('loadedmetadata', onMetadata);
    }
  }, [ref, initialTime, isTranscoded, id]);

  // 3. Time Events
  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const onTime = () => onTimeUpdate(startTime + video.currentTime);
    const onDur = () => onDurationChange(video.duration + startTime);

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDur);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDur);
    };
  }, [ref, startTime, onTimeUpdate, onDurationChange]);

  const shouldUseHlsJs = hlsSource && !isIOS && Hls.isSupported();
  // Don't set src if we have a browser error
  const videoSrc = (shouldUseHlsJs || browserError) ? undefined : (hlsSource || streamUrl(id, startTime));

  if (isIOS && streamMode === 'live' && !hlsSource) return null;

  const handleError = (e) => {
    const video = e.target;
    const err = video.error;
    let errorMsg = 'Unknown Error';
    if (err) {
      if (err.code === 1) errorMsg = 'Playback Aborted';
      else if (err.code === 2) errorMsg = 'Network Error';
      else if (err.code === 3) errorMsg = 'Decode Error';
      else if (err.code === 4) errorMsg = 'Source Not Supported';
    }
    
    console.error('[VideoElement] Playback Error: ' + errorMsg, {
      code: err ? err.code : 'UNKNOWN',
      message: err ? err.message : 'No detailed message',
      src: video.src,
      readyState: video.readyState,
      networkState: video.networkState
    });

    if (onPlayerError) onPlayerError(errorMsg);
  };

  return (
    <div className={styles.videoWrapper} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {browserError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          color: 'white',
          textAlign: 'center',
          padding: '20px'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Format Not Supported</h2>
          <p style={{ maxWidth: '400px', fontSize: '1.1rem' }}>{browserError}</p>
        </div>
      )}
      <video
        ref={ref}
        className={styles.videoPlayer}
        src={videoSrc}
        autoPlay
        playsInline
        webkit-playsinline="true"
        crossOrigin="anonymous"
        onPlay={onPlay}
        onPause={onPause}
        onError={handleError}
        style={browserError ? { visibility: 'hidden' } : {}}
      >
        {showSubtitles && (
          <track kind="subtitles" src={subtitleUrl(id)} srcLang="en" label="English" default />
        )}
      </video>
    </div>
  );
});

VideoElement.displayName = 'VideoElement';
