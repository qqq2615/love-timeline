import { useEffect } from 'react';
import { formatDateCN } from '../utils/dateUtils';
import { formatDuration as formatDurationLabel } from '../utils/media';

export default function MediaModal({ memory, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!memory) return null;

  const isVideo = memory.type === 'video';
  const hasMedia = Boolean(memory.url);

  return (
    <div className="modal-overlay photo-modal-overlay" onClick={onClose}>
      <div className="media-modal" onClick={(event) => event.stopPropagation()}>
        <button className="photo-modal-close" onClick={onClose}>✕</button>

        <div className="media-modal-content">
          {!hasMedia ? (
            <div className="upload-placeholder">
              <span className="upload-icon">{isVideo ? '🎞️' : '🖼️'}</span>
              <p>媒体文件未包含在云备份中</p>
              <p className="upload-hint">如果这是本地模式保存的内容，只能在原设备查看</p>
            </div>
          ) : isVideo ? (
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
          <p className="photo-modal-date">📮 {formatDateCN(memory.date)}</p>
          {memory.daysSinceAnniversary != null && (
            <p className="photo-modal-days">💕 在一起的第 <strong>{memory.daysSinceAnniversary}</strong> 天</p>
          )}
          {isVideo && memory.duration && (
            <p className="photo-modal-duration">🎞️ 时长 {formatDurationLabel(memory.duration)}</p>
          )}
          {memory.note && (
            <p className="photo-modal-note">{memory.note}</p>
          )}
        </div>
      </div>
    </div>
  );
}
