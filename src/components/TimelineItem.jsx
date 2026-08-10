import { useState, useEffect, useRef } from 'react';
import { formatDateShort } from '../utils/dateUtils';
import { formatDuration } from '../utils/media';

export default function TimelineItem({ memory, index, onMediaClick, onEdit, onDelete }) {
  const [visible, setVisible] = useState(false);
  const itemRef = useRef(null);
  const isLeft = index % 2 === 0;
  const isVideo = memory.type === 'video';

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (itemRef.current) observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, []);

  const handleDelete = () => {
    if (confirm('确定删除这条回忆吗？')) {
      onDelete(memory);
    }
  };

  return (
    <div
      ref={itemRef}
      className={`timeline-item ${isLeft ? 'left' : 'right'} ${visible ? 'visible' : ''}`}
    >
      <div className="timeline-node">
        <div className={`node-dot ${isVideo ? 'video' : ''}`} />
      </div>

      <div className="timeline-date-label">
        <span className="date-year">{new Date(memory.date).getFullYear()}</span>
        <span className="date-md">{formatDateShort(memory.date)}</span>
      </div>

      <div className="timeline-card">
        {/* 媒体区域 */}
        <div className="card-photo" onClick={() => onMediaClick(memory)}>
          <img
            src={memory.thumbUrl || memory.url}
            alt={memory.note || '回忆'}
            loading="lazy"
          />
          <div className="card-photo-overlay">
            <span>{isVideo ? '▶ 播放' : '🔍 查看'}</span>
          </div>
          {isVideo && (
            <div className="video-play-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <polygon points="8,5 19,12 8,19" />
              </svg>
              {memory.duration && (
                <span>{formatDuration(memory.duration)}</span>
              )}
            </div>
          )}
        </div>

        {/* 天数徽章 */}
        {memory.daysSinceAnniversary != null && (
          <div className="card-days-badge">
            <span className="heart-icon">♥</span>
            在一起的第 <strong>{memory.daysSinceAnniversary}</strong> 天
          </div>
        )}

        {/* 备注 */}
        {memory.note && (
          <p className="card-note">{memory.note}</p>
        )}

        <div className="card-actions">
          <button className="action-btn" onClick={() => onEdit(memory)} title="编辑">
            ✎
          </button>
          <button className="action-btn danger" onClick={handleDelete} title="删除">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
