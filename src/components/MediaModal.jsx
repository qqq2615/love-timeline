import { useEffect } from 'react';
import { formatDateCN } from '../utils/dateUtils';
import { formatDuration as fmtDur } from '../utils/media';

export default function MediaModal({ memory, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!memory) return null;

  const isVideo = memory.type === 'video';

  return (
    <div className="modal-overlay photo-modal-overlay" onClick={onClose}>
      <div className="media-modal" onClick={(e) => e.stopPropagation()}>
        <button className="photo-modal-close" onClick={onClose}>✕</button>

        <div className="media-modal-content">
          {isVideo ? (
            <video
              src={memory.url}
              className="media-modal-video"
              controls
              autoPlay
              playsInline
            >
              您的浏览器不支持视频播放
            </video>
          ) : (
            <img
              src={memory.url}
              alt={memory.note || '回忆'}
              className="media-modal-image"
            />
          )}
        </div>

        <div className="photo-modal-info">
          <p className="photo-modal-date">
            📅 {formatDateCN(memory.date)}
          </p>
          {memory.daysSinceAnniversary != null && (
            <p className="photo-modal-days">
              💕 在一起的第 <strong>{memory.daysSinceAnniversary}</strong> 天
            </p>
          )}
          {isVideo && memory.duration && (
            <p className="photo-modal-duration">
              🎬 时长 {fmtDur(memory.duration)}
            </p>
          )}
          {memory.note && (
            <p className="photo-modal-note">{memory.note}</p>
          )}
        </div>
      </div>
    </div>
  );
}
