import { useState, useEffect } from 'react';
import { daysBetween } from '../utils/dateUtils';
import { updateMemory } from '../utils/db';

export default function EditEntry({ memory, anniversary, onClose, onUpdated }) {
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [daysValue, setDaysValue] = useState(null);
  const [editingDate, setEditingDate] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (memory) {
      setDate(memory.date || '');
      setNote(memory.note || '');
      if (memory.date && anniversary) {
        setDaysValue(daysBetween(anniversary, memory.date));
      }
    }
  }, [memory, anniversary]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);
    if (anniversary && newDate) setDaysValue(daysBetween(anniversary, newDate));
  };

  const handleSave = async () => {
    if (!date) { setError('请设置日期'); return; }
    try {
      await updateMemory(memory.id, {
        date,
        daysSinceAnniversary: daysValue,
        note: note.trim(),
      });
      onUpdated?.();
      onClose();
    } catch (err) {
      setError('保存失败: ' + err.message);
    }
  };

  if (!memory) return null;
  const isVideo = memory.type === 'video';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
        <div className="add-panel-header">
          <h2>✎ 编辑回忆</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="add-panel-body">
          <div className="edit-photo-preview">
            {isVideo ? (
              <video src={memory.url} controls playsInline className="edit-video-preview" />
            ) : (
              <img src={memory.thumbUrl || memory.url} alt={memory.note || '回忆'} />
            )}
          </div>

          <div className="form-group">
            <label>📅 日期</label>
            {editingDate ? (
              <input type="date" className="form-input" value={date} onChange={handleDateChange}
                onBlur={() => setEditingDate(false)} autoFocus />
            ) : (
              <div className="date-display" onClick={() => setEditingDate(true)}>
                <span>{date || '未设置'}</span>
                {daysValue !== null && daysValue >= 0 && (
                  <span className="date-days-badge">在一起的第 {daysValue} 天</span>
                )}
                <span className="edit-icon">✎</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>💬 备注</label>
            <textarea className="form-textarea" value={note}
              onChange={(e) => setNote(e.target.value)} rows={3} placeholder="记录这个瞬间的故事..." />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button className="btn-cancel" onClick={onClose}>取消</button>
            <button className="btn-save" onClick={handleSave}>保存修改</button>
          </div>
        </div>
      </div>
    </div>
  );
}
