import { useEffect, useState } from 'react';
import { listBackups, downloadAndDecryptBackup, deleteBackup } from '../utils/backup';
import { importAllData } from '../utils/db';
import { getToken } from '../utils/auth';

function fmtDate(ms) {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '';
  }
}

export default function BackupManager({ onClose, onRestored }) {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (!getToken()) {
          throw new Error('请先登录后再管理云备份');
        }
        const backups = await listBackups();
        setList(backups.sort((a, b) => b.createdAt - a.createdAt));
      } catch (err) {
        setError(err.message || '获取失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRestore = async (id) => {
    const password = prompt('请输入备份口令：', '');
    if (!password) {
      alert('需要输入备份口令才能解密备份');
      return;
    }

    try {
      const data = await downloadAndDecryptBackup(id, password);
      if (!data) {
        alert('解密后没有有效数据');
        return;
      }

      await importAllData(data);
      if (onRestored) {
        onRestored(data);
      }
      alert('恢复完成');
      if (onClose) {
        onClose();
      }
    } catch (err) {
      alert(`恢复失败：${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个备份吗？此操作不可恢复。')) {
      return;
    }

    try {
      await deleteBackup(id);
      setList((prev) => prev.filter((item) => item.id !== id));
      alert('备份已删除');
    } catch (err) {
      alert(`删除失败：${err.message}`);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>云备份管理</h3>
        {loading ? (
          <p>加载中...</p>
        ) : (
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {error && <p className="form-error">{error}</p>}
            {list.length === 0 && <p>还没有云备份</p>}
            <ul>
              {list.map((item) => (
                <li key={item.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div><strong>{item.name || '（未命名）'}</strong></div>
                      <div style={{ fontSize: 12, color: '#666' }}>{fmtDate(item.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="setup-btn" onClick={() => handleRestore(item.id)}>恢复</button>
                      <button className="setup-btn" onClick={() => handleDelete(item.id)}>删除</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="setup-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
