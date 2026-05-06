import styles from '../Player.module.css';

const formatTime = (seconds) => {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export function ProgressBar({ currentTime, duration, onSeek }) {
  return (
    <div className={styles.progressContainer}>
      <span className={styles.timeLabel}>{formatTime(currentTime)}</span>
      <input
        type="range"
        min="0"
        max={duration || 100}
        value={currentTime}
        onChange={(e) => onSeek(parseFloat(e.target.value))}
        className={styles.seekBar}
      />
      <span className={styles.timeLabel}>{formatTime(duration)}</span>
    </div>
  );
}
