import { useEffect, useState } from 'react';
import { daysBetween, formatDateShort } from '../utils/dateUtils';
import { exportAllData, importAllData, downloadJSON, readJSONFile, clearAllData } from '../utils/db';
import { uploadEncryptedBackup, downloadAndDecryptBackup, listBackups } from '../utils/backup';
import { getSpaceLabel, getToken, logout } from '../utils/auth';
import Auth from './Auth';
import BackupManager from './BackupManager';

export default function Header({
  anniversary,
  coverUrl,
  onDataImported,
  onEditAnniversary,
  onAuthenticated,
  onLoggedOut,
}) {
  const [days, setDays] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [spaceLabel, setSpaceLabel] = useState(getSpaceLabel());

  useEffect(() => {
    if (!anniversary) {
      return undefined;
    }

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
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      try {
        const data = await readJSONFile(file);
        await importAllData(data);
        onDataImported(data);
      } catch (error) {
        alert(`导入失败：${error.message}`);
      }
    };
    input.click();
    setShowMenu(false);
  };

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？此操作不可恢复。')) {
      clearAllData().then(() => window.location.reload());
    }
    setShowMenu(false);
  };

  const isLoggedIn = !!getToken();

  const requireLogin = () => {
    if (!isLoggedIn) {
      alert('请先登录后再使用云端功能');
      setShowMenu(false);
      return false;
    }
    return true;
  };

  const handleCloudUpload = async () => {
    setShowMenu(false);
    if (!requireLogin()) {
      return;
    }

    try {
      const data = await exportAllData();
      const password = prompt('请输入这次云备份使用的备份口令：', '');
      if (!password) {
        alert('需要输入备份口令才能加密备份');
        return;
      }
      const id = await uploadEncryptedBackup(data, password);
      prompt('备份已上传，请保存这个备份 ID，换设备恢复时会用到：', id);
    } catch (error) {
      alert(`上传失败：${error.message}`);
    }
  };

  const handleCloudRestore = async () => {
    setShowMenu(false);
    if (!requireLogin()) {
      return;
    }

    try {
      const id = prompt('请输入备份 ID：', '');
      if (!id) {
        return;
      }
      const password = prompt('请输入备份口令：', '');
      if (!password) {
        alert('需要输入备份口令才能解密备份');
        return;
      }

      const data = await downloadAndDecryptBackup(id, password);
      if (!data) {
        alert('解密后没有拿到有效数据');
        return;
      }

      await importAllData(data);
      onDataImported(data);
      alert('恢复完成');
    } catch (error) {
      alert(`恢复失败：${error.message}`);
    }
  };

  const handleSyncLatestBackup = async () => {
    setShowMenu(false);
    if (!requireLogin()) {
      return;
    }

    try {
      const backupList = await listBackups();
      if (!backupList || backupList.length === 0) {
        alert('当前没有可用备份');
        return;
      }

      const latest = backupList.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!latest) {
        alert('未找到最新备份');
        return;
      }

      const password = prompt(`请输入用于解密备份 ${latest.name || latest.id} 的备份口令：`, '');
      if (!password) {
        alert('需要输入备份口令才能解密备份');
        return;
      }

      const data = await downloadAndDecryptBackup(latest.id, password);
      await importAllData(data);
      onDataImported(data);
      alert('已同步最新备份');
    } catch (error) {
      alert(`同步失败：${error.message}`);
    }
  };

  const handleLogout = () => {
    logout();
    setSpaceLabel(null);
    if (onLoggedOut) {
      onLoggedOut();
    }
    alert('已退出登录');
  };

  const handleAuthSuccess = () => {
    setSpaceLabel(getSpaceLabel());
    setShowAuth(false);
    if (onAuthenticated) {
      onAuthenticated();
    }
    alert('登录成功');
  };

  return (
    <header className="header">
      {coverUrl && <div className="header-cover-strip" />}
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">💕 恋爱时光轴</h1>
          {anniversary && <p className="header-date">从 {formatDateShort(anniversary)} 开始</p>}
          {spaceLabel && <p className="header-user">共享空间：{spaceLabel}</p>}
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
          <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>☰</button>
          {showMenu && (
            <div className="menu-dropdown">
              <button onClick={() => { onEditAnniversary(); setShowMenu(false); }}>📐 纪念日设置</button>
              {!isLoggedIn && <button onClick={() => { setShowAuth(true); setShowMenu(false); }}>🔐 登录共享空间</button>}
              {isLoggedIn && <button onClick={() => { handleLogout(); setShowMenu(false); }}>🚪 退出登录</button>}
              {isLoggedIn && <button onClick={() => { setShowBackupManager(true); setShowMenu(false); }}>☁️ 管理云备份</button>}
              {isLoggedIn && <button onClick={() => { handleSyncLatestBackup(); setShowMenu(false); }}>🔄 同步最新备份</button>}
              <button onClick={handleExport}>💾 导出备份</button>
              <button onClick={handleImport}>📂 导入数据</button>
              <button onClick={handleCloudUpload}>☁️ 上传云备份</button>
              <button onClick={handleCloudRestore}>☁️ 从云恢复</button>
              <button onClick={handleReset}>🗑️ 重置全部</button>
            </div>
          )}
          {showAuth && (
            <Auth onClose={() => setShowAuth(false)} onAuthenticated={handleAuthSuccess} />
          )}
          {showBackupManager && (
            <BackupManager
              onClose={() => setShowBackupManager(false)}
              onRestored={(data) => {
                onDataImported(data);
              }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
