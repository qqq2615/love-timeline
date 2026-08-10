import { useState, useEffect, useRef } from 'react';
import { loadSettings, saveSettings } from '../utils/db';
import { compressImage } from '../utils/media';
import { uploadToOSS } from '../utils/uploader';
import { daysBetween } from '../utils/dateUtils';

export default function SetupPage({ onComplete, editing = false, initialData = null }) {
  const today = new Date().toISOString().slice(0, 10);
  const fileRef = useRef(null);
  const [date, setDate] = useState(initialData?.anniversary || '');
  const [coverUrl, setCoverUrl] = useState(initialData?.coverUrl || '');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!editing) {
      loadSettings().then((s) => {
        if (s?.anniversary) {
          onComplete({ anniversary: s.anniversary, coverUrl: s.coverUrl || '' });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (date) {
      setPreview(daysBetween(date));
    } else {
      setPreview(null);
    }
  }, [date]);

  const handleDateChange = (e) => setDate(e.target.value);

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    setLoading(true);
    try {
      setUploading(true);
      const result = await uploadToOSS(file, 'cover.jpg', 'cover');
      setCoverUrl(result.url);
    } catch (err) {
      console.error('封面上传失败:', err);
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  const handleRemoveCover = () => setCoverUrl('');

  const handleSubmit = async () => {
    if (!date) return;
    await saveSettings({ anniversary: date, coverUrl });
    const s = await loadSettings();
    onComplete(s);
  };

  return (
    <div className="setup-page">
      <div className="setup-card">
        {/* 封面照片 */}
        <div
          className={`cover-photo-area ${coverUrl ? 'has-cover' : ''}`}
          onClick={() => !coverUrl && !loading && fileRef.current?.click()}
        >
          {loading ? (
            <div className="cover-loading">
              <div className="spinner" />
              <p>{uploading ? '上传中...' : '处理中...'}</p>
            </div>
          ) : coverUrl ? (
            <div className="cover-photo-wrapper">
              <img src={coverUrl} alt="封面" className="cover-photo-img" />
              <div className="cover-photo-actions">
                <button className="cover-action-btn" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                  🔄 更换
                </button>
                <button className="cover-action-btn" onClick={(e) => { e.stopPropagation(); handleRemoveCover(); }}>
                  ✕ 移除
                </button>
              </div>
            </div>
          ) : (
            <div className="cover-placeholder">
              <span className="cover-icon">🖼️</span>
              <p>添加一张封面照片</p>
              <p className="cover-hint">你们的合照 💑</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />
        </div>

        <div className="setup-heart">💕</div>
        <h1 className="setup-title">{editing ? '编辑纪念日' : '我们的恋爱时光轴'}</h1>
        {!editing && (
          <p className="setup-desc">记录每一个心动的瞬间<br />让爱意在时光里流淌</p>
        )}

        <div className="setup-form">
          <label className="setup-label">📅 我们在一起的那一天</label>
          <input type="date" className="setup-input" value={date} onChange={handleDateChange} max={today} />

          {preview !== null && preview >= 0 && (
            <div className="setup-preview">
              <p>已经在一起</p>
              <span className="setup-days">{preview}</span>
              <p>天啦 ✨</p>
            </div>
          )}
          {preview !== null && preview < 0 && (
            <div className="setup-preview">
              <p>还有</p>
              <span className="setup-days">{Math.abs(preview)}</span>
              <p>天就要在一起啦 🎉</p>
            </div>
          )}

          <button className="setup-btn" onClick={handleSubmit} disabled={!date}>
            {editing ? '保存修改 💝' : '开始记录 💝'}
          </button>
        </div>
      </div>
    </div>
  );
}
