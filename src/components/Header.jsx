import { useEffect, useState } from 'react';
import { daysBetween } from '../utils/dateUtils';
import {
  exportAllData,
  exportCloudBackupData,
  importAllData,
  downloadJSON,
  readJSONFile,
  clearAllData,
} from '../utils/db';
import { uploadEncryptedBackup, downloadAndDecryptBackup, listBackups } from '../utils/backup';
import { getLoginPassword, getToken, logout } from '../utils/auth';
import Auth from './Auth';
import BackupManager from './BackupManager';

const DEFAULT_CLOUD_BACKUP_ID = 'latest';

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

  const requireBackupPassword = () => {
    const password = getLoginPassword();
    if (!password) {
      alert('当前浏览器没有保存登录密码，请先退出后重新登录一次，再使用云备份。');
      setShowMenu(false);
      return null;
    }
    return password;
  };

  const handleCloudUpload = async () => {
    setShowMenu(false);
    if (!requireLogin()) {
      return;
    }

    const password = requireBackupPassword();
    if (!password) {
      return;
    }

    try {
      const { data, stats } = await exportCloudBackupData();
      await uploadEncryptedBackup(data, password, { backupId: DEFAULT_CLOUD_BACKUP_ID });

      if (stats.excludedLocalMediaCount > 0) {
        alert(`云备份成功。已自动跳过 ${stats.excludedLocalMediaCount} 条仅保存在本机的媒体内容，这些内容无法跨设备恢复。`);
        return;
      }

      alert('云备份成功');
    } catch (error) {
      alert(`上传失败：${error.message}`);
    }
  };

  const handleCloudRestore = async () => {
    setShowMenu(false);
    if (!requireLogin()) {
      return;
    }

    const password = requireBackupPassword();
    if (!password) {
      return;
    }

    try {
      const data = await downloadAndDecryptBackup(DEFAULT_CLOUD_BACKUP_ID, password);
      if (!data) {
        alert('恢复失败：没有拿到有效数据');
        return;
      }

      await importAllData(data);
      onDataImported(data);
      alert('恢复成功');
    } catch (error) {
      alert(`恢复失败：${error.message}`);
    }
  };

  const handleSyncLatestBackup = async () => {
    setShowMenu(false);
    if (!requireLogin()) {
      return;
    }

    const password = requireBackupPassword();
    if (!password) {
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
    if (onLoggedOut) {
      onLoggedOut();
    }
    alert('已退出登录');
  };

  const handleAuthSuccess = () => {
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
