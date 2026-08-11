import { useState, useEffect } from 'react';
import { daysBetween, formatDateShort } from '../utils/dateUtils';
import { exportAllData, importAllData, downloadJSON, readJSONFile, clearAllData } from '../utils/db';
import { uploadEncryptedBackup, downloadAndDecryptBackup, listBackups } from '../utils/backup';
import { getUsername, logout } from '../utils/auth';
import Auth from './Auth';
import BackupManager from './BackupManager';

export default function Header({ anniversary, coverUrl, onDataImported, onEditAnniversary, onAuthenticated }) {
  const [days, setDays] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [username, setUsername] = useState(getUsername());

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

  const isLoggedIn = !!username;

  const requireLogin = () => {
    if (!isLoggedIn) {
      alert('请先登录再使用云端功能');
      setShowMenu(false);
      return false;
    }
    return true;
  };

  const handleCloudUpload = async () => {
    setShowMenu(false);
    if (!requireLogin()) return;
    try {
      const data = await exportAllData();
      const username = prompt('输入用于加密的用户名（与恢复时一致）：', getUsername() || '') || '';
      const password = prompt('输入用于加密的密码：', '');
      if (!password) return alert('需要密码以加密备份');
      const id = await uploadEncryptedBackup(data, username, password);
      prompt('备份已上传，请保存此备份 ID，并在另一台设备恢复时使用：', id);
    } catch (err) {
      alert('上传失败：' + err.message);
    }
  };

  const handleCloudRestore = async () => {
    setShowMenu(false);
    if (!requireLogin()) return;
    try {
      const id = prompt('输入备份 ID：', '');
      if (!id) return;
      const username = prompt('输入用于解密的用户名（与上传时一致）：', getUsername() || '') || '';
      const password = prompt('输入用于解密的密码：', '');
      if (!password) return alert('需要密码以解密备份');
      const data = await downloadAndDecryptBackup(id, username, password);
      if (!data) return alert('解密后无有效数据');
      await importAllData(data);
      onDataImported(data);
      alert('恢复完成');
    } catch (err) {
      alert('恢复失败：' + err.message);
    }
  };

  const handleSyncLatestBackup = async () => {
    setShowMenu(false);
    if (!requireLogin()) return;
    try {
      const list = await listBackups();
      if (!list || list.length === 0) return alert('当前没有可用备份');
      const latest = list.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!latest) return alert('未找到最新备份');
      const password = prompt(`请输入用于解密备份 ${latest.name || latest.id} 的密码：`, '');
      if (!password) return alert('需要密码以解密备份');
      const username = getUsername() || '';
      const data = await downloadAndDecryptBackup(latest.id, username, password);
      await importAllData(data);
      onDataImported(data);
      alert('已同步最新备份');
    } catch (err) {
      alert('同步失败：' + err.message);
    }
  };

  const handleLogout = () => {
    logout();
    setUsername(null);
    alert('已退出登录');
  };

  const handleAuthSuccess = () => {
    setUsername(getUsername());
    setShowAuth(false);
    if (onAuthenticated) onAuthenticated();
    alert('登录成功');
  };

  return (
    <header className="header">
      {coverUrl && <div className="header-cover-strip" />}
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">💕 恋爱时光轴</h1>
          {anniversary && <p className="header-date">从 {formatDateShort(anniversary)} 开始</p>}
          {username && <p className="header-user">已登录：{username}</p>}
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
              {!username && <button onClick={() => { setShowAuth(true); setShowMenu(false); }}>🔐 登录/注册</button>}
              {username && <button onClick={() => { handleLogout(); setShowMenu(false); }}>🚪 退出登录</button>}
              {username && <button onClick={() => { setShowBackupManager(true); setShowMenu(false); }}>☁️ 管理云备份</button>}
              {username && <button onClick={() => { handleSyncLatestBackup(); setShowMenu(false); }}>🔄 同步最新备份</button>}
              <button onClick={handleExport}>📥 导出备份</button>
              <button onClick={handleImport}>📤 导入数据</button>
              <button onClick={handleCloudUpload}>☁️ 上传云备份</button>
              <button onClick={handleCloudRestore}>☁️ 从云恢复</button>
              <button onClick={handleReset}>🗑️ 重置全部</button>
            </div>
          )}
          {showAuth && (
            <Auth onClose={() => setShowAuth(false)} onAuthenticated={handleAuthSuccess} />
          )}
          {showBackupManager && (
            <BackupManager onClose={() => setShowBackupManager(false)} onRestored={(data) => { onDataImported(data); }} />
          )}
        </div>
      </div>
    </header>
  );
}
