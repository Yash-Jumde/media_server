'use client';

import { useEffect, useState } from 'react';
import { fetchTranscodeQueue } from '@/lib/api';
import { Loader2, Film, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './TranscodeQueue.module.css';

export default function TranscodeQueue({ compact = false }) {
  const [status, setStatus] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await fetchTranscodeQueue();
        setStatus(data);
        // Show only if there's something in the queue or currently processing, 
        // OR if not in compact mode (so it's always visible in large views)
        setIsVisible(!compact || data.currentTask !== null || data.queue.length > 0);
      } catch (err) {
        console.error('Failed to fetch transcode queue:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [compact]);

  if (!isVisible || !status) return null;

  const { currentTask, activeTasks = [], queue } = status;
  // Use activeTasks if available, fallback to currentTask for backward compatibility
  const currentTasks = activeTasks.length > 0 ? activeTasks : (currentTask ? [currentTask] : []);
  
  const INITIAL_VISIBLE_COUNT = compact ? 2 : 3;
  const visibleQueue = showAll ? queue : queue.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMore = queue.length > INITIAL_VISIBLE_COUNT;
  const isEmpty = currentTasks.length === 0 && queue.length === 0;

  return (
    <section className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <h2 className={styles.title}>
        <Loader2 size={compact ? 16 : 20} className={(currentTasks.length > 0 || !isEmpty) ? styles.spinIcon : ''} />
        {compact ? 'Transcoding' : `Transcoding Queue (${queue.length + currentTasks.length})`}
      </h2>
      
      <div className={styles.queueList}>
        {isEmpty && !compact && (
          <div className={styles.emptyText}>No active transcoding tasks</div>
        )}
        
        {currentTasks.map((task, index) => (
          <div key={`active-${task.mediaId || index}`} className={`${styles.itemActive} ${compact ? styles.compactItem : ''}`}>
            <div className={styles.itemIcon}>
              <Film size={compact ? 16 : 20} />
            </div>
            <div className={styles.itemInfo}>
              <div className={styles.itemName}>
                {compact ? (
                  <span className={styles.processing}>Active: {task.filename}</span>
                ) : (
                  <><span className={styles.processing}>{task.isExternal ? 'External:' : 'Processing:'}</span> {task.filename}</>
                )}
              </div>
              <div className={styles.progressContainer}>
                <div 
                  className={styles.progressBar} 
                  style={{ width: `${task.progress}%` }} 
                />
                {!compact && <span className={styles.progressText}>{task.progress}%</span>}
              </div>
              {compact && <div className={styles.compactProgressText}>{task.progress}% complete</div>}
            </div>
          </div>
        ))}

        {visibleQueue.map((task, i) => (
          <div key={i} className={`${styles.itemPending} ${compact ? styles.compactItem : ''}`}>
            <div className={styles.itemIcon}>
              <Film size={compact ? 16 : 20} />
            </div>
            <div className={styles.itemInfo}>
              <div className={styles.itemName}>{task.filename}</div>
              {!compact && <div className={styles.statusText}>Queued</div>}
            </div>
          </div>
        ))}

        {hasMore && (
          <button 
            className={styles.showMoreBtn} 
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <>
                <ChevronUp size={16} /> Show Less
              </>
            ) : (
              <>
                <ChevronDown size={16} /> Show More ({queue.length - INITIAL_VISIBLE_COUNT} remaining)
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
