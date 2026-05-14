import { useEffect, useCallback } from 'react';

export function usePlayerShortcuts({
  mediaRef,
  onClose,
  toggleFullscreen,
  onNext,
  onPrev,
  fileType,
  isTranscoded,
  duration,
  startTime,
  setStartTime,
  setIsPaused,
  timeRef,
  resetControlsTimeout
}) {
  const handleKey = useCallback((e) => {
    resetControlsTimeout();
    switch (e.key.toLowerCase()) {
      case 'escape':
        onClose();
        break;
      case ' ':
        if (mediaRef.current) {
          e.preventDefault();
          if (mediaRef.current.paused) {
            mediaRef.current.play()
              .then(() => setIsPaused?.(false))
              .catch(err => console.error('[Player] Play failed (Space):', err.name, err.message));
          } else {
            mediaRef.current.pause();
            setIsPaused?.(true);
          }
        }
        break;
      case 'arrowright':
        if (fileType === 'image') {
          onNext?.();
        } else if (mediaRef.current) {
          const seconds = 10;
          if (isTranscoded) {
            const newTime = Math.max(0, Math.min(duration, (startTime + mediaRef.current.currentTime) + seconds));
            setStartTime(newTime);
            mediaRef.current.currentTime = 0;
            timeRef.current = newTime;
          } else {
            const newTime = Math.max(0, Math.min(duration, mediaRef.current.currentTime + seconds));
            mediaRef.current.currentTime = newTime;
            timeRef.current = newTime;
          }
        }
        break;
      case 'arrowleft':
        if (fileType === 'image') {
          onPrev?.();
        } else if (mediaRef.current) {
          const seconds = -10;
          if (isTranscoded) {
            const newTime = Math.max(0, Math.min(duration, (startTime + mediaRef.current.currentTime) + seconds));
            setStartTime(newTime);
            mediaRef.current.currentTime = 0;
            timeRef.current = newTime;
          } else {
            const newTime = Math.max(0, Math.min(duration, mediaRef.current.currentTime + seconds));
            mediaRef.current.currentTime = newTime;
            timeRef.current = newTime;
          }
        }
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'm':
        if (mediaRef.current) {
          mediaRef.current.muted = !mediaRef.current.muted;
        }
        break;
    }
  }, [
    onClose,
    mediaRef,
    toggleFullscreen,
    onNext,
    onPrev,
    fileType,
    isTranscoded,
    duration,
    startTime,
    setStartTime,
    setIsPaused,
    timeRef,
    resetControlsTimeout
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);
}
