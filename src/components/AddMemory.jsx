import { useState, useRef } from 'react';
import { daysBetween, formatDate, generateId } from '../utils/dateUtils';
import { addMemory } from '../utils/db';
import { compressImage, createThumbnail, captureVideoFrame, extractPhotoDate, formatDuration } from '../utils/media';
import { deleteFromOSS, uploadToOSS } from '../utils/uploader';

const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB

export default function AddMemory({ anniversary, onAdded }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState('photo'); // 'photo' | 'video'
  const [file, setFile] = useState(null);       // 原始 File
  const [preview, setPreview] = useState(null); // 预览 URL
  const [thumbnail, setThumbnail] = useState(null); // 缩略图 Blob
  const [photoDate, setPhotoDate] = useState('');
  const [daysValue, setDaysValue] = useState(null);
  const [note, setNote] = useState('');
  const [videoDuration, setVideoDuration] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | processing | uploading | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  const fileRef = useRef(null);

  const handleFileSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // 验证
    if (tab === 'photo' && !f.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    if (tab === 'video' && !f.type.startsWith('video/')) {
      setError('请选择视频文件');
      return;
    }
    if (tab === 'video' && f.size > MAX_VIDEO_SIZE) {
      setError('视频文件不能超过 200MB');
      return;
    }

    setError('');
    setStage('processing');
    setFile(f);

    try {
      // 预览
      const previewUrl = URL.createObjectURL(f);
      setPreview(previewUrl);

      // 生成缩略图
      if (tab === 'photo') {
        const thumb = await createThumbnail(f);
        setThumbnail(thumb);
      } else {
        const result = await captureVideoFrame(f);
        setThumbnail(result.blob);
        setVideoDuration(result.duration);
      }

      // 提取日期
      const date = await extractPhotoDate(f);
      setPhotoDate(date);
      if (anniversary) {
        setDaysValue(daysBetween(anniversary, date));
      }

      setStage('idle');
    } catch (err) {
      console.error('处理文件失败:', err);
      setError('文件处理失败，请重试');
      setStage('idle');
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setPhotoDate(newDate);
    if (anniversary && newDate) {
      setDaysValue(daysBetween(anniversary, newDate));
    }
  };

  const handleSubmit = async () => {
    if (!file || !thumbnail) {
      setError('请先选择文件');
      return;
    }
    if (!photoDate) {
      setError('请设置日期');
      return;
    }

    setStage('uploading');
    setProgress(0);
    setError('');

    const uploadedKeys = [];

    try {
      const ext = file.name.split('.').pop();
      const filePrefix = tab === 'photo' ? 'photos' : 'videos';

      // 并行上传主文件和缩略图
      const [mainResult, thumbResult] = await Promise.all([
        uploadToOSS(
          tab === 'photo' ? await compressImage(file) : file,
          `memory.${tab === 'photo' ? 'jpg' : ext}`,
          filePrefix,
          (p) => setProgress(Math.floor(p * 0.7))
        ),
        uploadToOSS(thumbnail, 'thumb.jpg', 'thumbs', (p) =>
          setProgress(70 + Math.floor(p * 0.3))
        ),
      ]);

      uploadedKeys.push(mainResult.key, thumbResult.key);

      const memory = {
        id: generateId(),
        type: tab,
        url: mainResult.url,
        thumbUrl: thumbResult.url,
        storageMode: mainResult.storageMode || thumbResult.storageMode || 'remote',
        storageKey: mainResult.key,
        thumbKey: thumbResult.key,
        date: photoDate,
        daysSinceAnniversary: daysValue !== null ? daysValue : daysBetween(anniversary, photoDate),
        note: note.trim(),
        duration: tab === 'video' ? videoDuration : undefined,
        createdAt: new Date().toISOString(),
      };

      await addMemory(memory);

      // 重置
      setFile(null);
      setPreview(null);
      setThumbnail(null);
      setPhotoDate('');
      setDaysValue(null);
      setNote('');
      setVideoDuration(null);
      setStage('done');
      setIsOpen(false);
      onAdded?.();
    } catch (err) {
      console.error('上传失败:', err);
      if (uploadedKeys.length > 0) {
        try {
          await deleteFromOSS(uploadedKeys);
        } catch (cleanupError) {
          console.error('清理已上传文件失败:', cleanupError);
        }
      }
      setError('上传失败: ' + err.message);
      setStage('idle');
    }
  };

  const handleCancel = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setThumbnail(null);
    setPhotoDate('');
    setDaysValue(null);
    setNote('');
    setVideoDuration(null);
    setStage('idle');
    setProgress(0);
    setError('');
    setIsOpen(false);
  };

  const handleTabSwitch = (t) => {
    if (file && t !== tab) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(null);
      setPreview(null);
      setThumbnail(null);
      setPhotoDate('');
      setDaysValue(null);
      setNote('');
      setVideoDuration(null);
      setError('');
      setStage('idle');
    }
    setTab(t);
    // 更新 accept 触发文件选择器限制
  };

  const acceptType = tab === 'photo' ? 'image/*' : 'video/*';

  return (
    <>
      <button className="fab" onClick={() => setIsOpen(true)}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="add-panel" onClick={(e) => e.stopPropagation()}>
            <div className="add-panel-header">
              <h2>✨ 添加新回忆</h2>
              <button className="close-btn" onClick={handleCancel}>✕</button>
            </div>

            {/* Tab 切换 */}
            <div className="tab-bar">
              <button
                className={`tab-btn ${tab === 'photo' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('photo')}
              >
                📸 照片
              </button>
              <button
                className={`tab-btn ${tab === 'video' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('video')}
              >
                🎬 视频
              </button>
            </div>

            <div className="add-panel-body">
              {/* 上传区域 */}
              <div
                className={`upload-area ${preview ? 'has-photo' : ''}`}
                onClick={() => !preview && stage === 'idle' && fileRef.current?.click()}
              >
                {stage === 'processing' ? (
                  <div className="upload-loading">
                    <div className="spinner" />
                    <p>处理中...</p>
                  </div>
                ) : stage === 'uploading' ? (
                  <div className="upload-loading">
                    <div className="spinner" />
                    <p>上传中 {progress}%</p>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : preview ? (
                  <div className="upload-preview-wrap">
                    {tab === 'video' ? (
                      <video
                        src={preview}
                        className="upload-preview"
                        controls
                        onClick={() => fileRef.current?.click()}
                      />
                    ) : (
                      <img
                        src={preview}
                        alt="预览"
                        className="upload-preview"
                        onClick={() => fileRef.current?.click()}
                      />
                    )}
                    {videoDuration && (
                      <span className="video-duration-badge">
                        {formatDuration(videoDuration)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">{tab === 'photo' ? '📸' : '🎬'}</span>
                    <p>点击选择{tab === 'photo' ? '照片' : '视频'}</p>
                    <p className="upload-hint">
                      {tab === 'photo' ? '支持 JPG / PNG / HEIC' : '支持 MP4 / MOV，最大 200MB'}
                    </p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept={acceptType}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>

              {/* 日期 */}
              <div className="form-group">
                <label>📅 拍摄日期</label>
                {editingDate ? (
                  <input
                    type="date"
                    className="form-input"
                    value={photoDate}
                    onChange={handleDateChange}
                    onBlur={() => setEditingDate(false)}
                    autoFocus
                  />
                ) : (
                  <div className="date-display" onClick={() => setEditingDate(true)}>
                    {photoDate ? (
                      <>
                        <span>{photoDate}</span>
                        {daysValue !== null && daysValue >= 0 && (
                          <span className="date-days-badge">
                            在一起的第 {daysValue} 天
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="date-placeholder">选择文件后自动识别，点击可修改</span>
                    )}
                    <span className="edit-icon">✎</span>
                  </div>
                )}
              </div>

              {/* 备注 */}
              <div className="form-group">
                <label>💬 此刻心情 / 备注</label>
                <textarea
                  className="form-textarea"
                  placeholder="记录这个瞬间的故事..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>

              {error && <p className="form-error">{error}</p>}

              <div className="form-actions">
                <button className="btn-cancel" onClick={handleCancel}>取消</button>
                <button
                  className="btn-save"
                  onClick={handleSubmit}
                  disabled={!file || stage === 'uploading' || stage === 'processing'}
                >
                  {stage === 'uploading' ? `上传中 ${progress}%` : '保存回忆 💕'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
