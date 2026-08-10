import { useState, useEffect } from 'react';
import { daysBetween, formatDateShort } from '../utils/dateUtils';
import { exportAllData, importAllData, downloadJSON, readJSONFile, clearAllData } from '../utils/db';

export default function Header({ anniversary, coverUrl, onDataImported, onEditAnniversary }) {
  const [days, setDays] = useState(0);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!anniversary) return;
    setDays(daysBetween(anniversary));
    const timer = setInterval(() => setDays(daysBetween(anniversary)), 60000);
    return () => clearInterval(timer);
  }, [anniversary]);

  const handleExport = async () => {
    const data = await exportAllData();
    downloadJSON(data, `love-timeline-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setShowMenu(false);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await readJSONFile(file);
        await importAllData(data);
        onDataImported(data);
      } catch (err) {
        alert('导入失败：' + err.message);
      }
    };
    input.click();
    setShowMenu(false);
  };

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？此操作不可恢复！')) {
      clearAllData().then(() => window.location.reload());
    }
    setShowMenu(false);
  };

  return (
    <header className="header">
      {coverUrl && <div className="header-cover-strip" />}
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">💕 恋爱时光轴</h1>
          {anniversary && <p className="header-date">从 {formatDateShort(anniversary)} 开始</p>}
        </div>

        <div className="header-center">
          <div className="day-counter">
            {coverUrl && (
              <div className="header-cover-thumb" onClick={onEditAnniversary} title="点击修改纪念日设置">
                <img src={coverUrl} alt="封面" />
              </div>
            )}
            <span className="day-number">{days}</span>
            <span className="day-label">天</span>
          </div>
          <p className="day-subtitle">在一起</p>
        </div>

        <div className="header-right">
          <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>⋯</button>
          {showMenu && (
            <div className="menu-dropdown">
              <button onClick={() => { onEditAnniversary(); setShowMenu(false); }}>💝 纪念日设置</button>
              <button onClick={handleExport}>📥 导出备份</button>
              <button onClick={handleImport}>📤 导入数据</button>
              <button onClick={handleReset}>🗑️ 重置全部</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
