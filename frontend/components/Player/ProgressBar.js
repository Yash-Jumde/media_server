import { useState, useEffect, useRef } from 'react';
import { spriteUrl, spriteMetaUrl } from '@/lib/api';
import styles from '../Player.module.css';

const formatTime = (seconds) => {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export function ProgressBar({ currentTime, duration, onSeek, mediaId }) {
  const percent = duration ? (currentTime / duration) * 100 : 0;
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPos, setHoverPos] = useState(0);
  const [spriteMeta, setSpriteMeta] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (mediaId) {
      fetch(spriteMetaUrl(mediaId))
        .then(res => res.ok ? res.json() : null)
        .then(data => setSpriteMeta(data))
        .catch(() => setSpriteMeta(null));
    }
  }, [mediaId]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const p = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(p * duration);
    setHoverPos(x);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleMouseMove(e); // Initial position
  };

  // Sprite Calculation
  let thumbStyle = {};
  let previewWrapperStyle = {};
  
  if (spriteMeta && isDragging && hoverTime !== null) {
    const { interval, cols, width, height } = spriteMeta;
    const frameIndex = Math.floor(hoverTime / interval);
    const col = frameIndex % cols;
    const row = Math.floor(frameIndex / cols);

    previewWrapperStyle = {
      left: `${hoverPos}px`,
      display: 'block',
      position: 'absolute',
      bottom: '45px',
      transform: 'translateX(-50%)',
      width: `${width}px`,
      zIndex: 100
    };

    thumbStyle = {
      backgroundImage: `url("${spriteUrl(mediaId)}")`,
      backgroundPosition: `-${col * width}px -${row * height}px`,
      backgroundSize: `${cols * width}px auto`,
      width: `${width}px`,
      height: `${height}px`,
      backgroundColor: '#000',
      border: '2px solid #fff',
      borderRadius: '4px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      display: 'block'
    };
  }

  return (
    <div 
      className={styles.progressContainer} 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
    >
      {isDragging && spriteMeta && (
        <div style={previewWrapperStyle}>
          <div style={thumbStyle} />
          <div className={styles.scrubTime}>{formatTime(hoverTime)}</div>
        </div>
      )}
      <span className={styles.timeLabel}>{formatTime(currentTime)}</span>
      <input
        type="range"
        min="0"
        max={duration || 100}
        value={currentTime}
        onChange={(e) => onSeek(parseFloat(e.target.value))}
        className={styles.seekBar}
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percent}%, rgba(255, 255, 255, 0.2) ${percent}%, rgba(255, 255, 255, 0.2) 100%)`
        }}
      />
      <span className={styles.timeLabel}>{formatTime(duration)}</span>
    </div>
  );
}
