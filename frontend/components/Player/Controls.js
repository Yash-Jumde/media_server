import { Volume2, VolumeX, SkipBack, SkipForward, Play, Pause, Captions, ChevronLeft, Maximize, Minimize, Heart, X } from 'lucide-react';
import styles from '../Player.module.css';

export function Controls({
  onClose,
  isMuted,
  setIsMuted,
  volume,
  setVolume,
  onSkipBack,
  onSkipForward,
  isPaused,
  onTogglePlay,
  showSubtitles,
  setShowSubtitles,
  showControls,
  isFullscreen,
  toggleFullscreen,
  isFavorite,
  onToggleFavorite,
  children
}) {
  return (
    <div className={`${styles.controlsOverlay} ${!showControls ? styles.hidden : ''}`}>
      <div className={styles.topControls}>
        <button className={styles.backBtn} onClick={onClose}>
          <ChevronLeft size={32} />
        </button>
      </div>

      <div className={styles.topRightControls}>
        <button className={styles.controlBtn} onClick={onToggleFavorite}>
          <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? styles.favorited : ''} />
        </button>
        <button className={styles.controlBtn} onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
        </button>
        <button className={styles.controlBtn} onClick={onClose}>
          <X size={24} />
        </button>
      </div>

      {children}

      <div className={styles.controlsRow}>
        <div className={styles.volumeGroup}>
          <button className={styles.controlBtn} onClick={() => setIsMuted(!isMuted)}>
            {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={isMuted ? 0 : volume} 
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              setIsMuted(false);
            }}
            className={styles.volumeSlider}
            style={{
              background: `linear-gradient(to right, #fff 0%, #fff ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) 100%)`
            }}
          />
        </div>

        <div className={styles.mainControls}>
          <button className={styles.controlBtn} onClick={onSkipBack}>
            <SkipBack size={24} />
          </button>
          
          <button className={styles.playBtn} onClick={onTogglePlay}>
            {isPaused ? <Play size={32} fill="currentColor" /> : <Pause size={32} fill="currentColor" />}
          </button>
          
          <button className={styles.controlBtn} onClick={onSkipForward}>
            <SkipForward size={24} />
          </button>
        </div>

        <div className={styles.secondaryControls}>
          <button 
            className={`${styles.controlBtn} ${showSubtitles ? styles.active : ''}`} 
            onClick={() => setShowSubtitles(!showSubtitles)}
          >
            <Captions size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
