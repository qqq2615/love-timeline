import { useState, useCallback, useEffect, useRef } from 'react';
import { loadSettings, getAllMemories, deleteMemory } from './utils/db';
import { deleteFromOSS } from './utils/uploader';
import { getToken } from './utils/auth';
import { getLoginPassword } from './utils/auth';
import { resolveSyncConflict } from './utils/sync';
import { exportCloudBackupData } from './utils/db';
import { uploadEncryptedBackup } from './utils/backup';
import Auth from './components/Auth';
import SetupPage from './components/SetupPage';
import Header from './components/Header';
import Timeline from './components/Timeline';
import AddMemory from './components/AddMemory';
import MediaModal from './components/MediaModal';
import EditEntry from './components/EditEntry';
import './App.css';

export default function App() {
  const [settings, setSettings] = useState(null);
  const [memories, setMemories] = useState([]);
  const [mediaModal, setMediaModal] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [showAnniversaryEditor, setShowAnniversaryEditor] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [loading, setLoading] = useState(true);
  const [backupStatus, setBackupStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const backupTimerRef = useRef(null);
  const backupMsgRef = useRef('');

  useEffect(() => {
    (async () => {
      const currentSettings = await loadSettings();
      if (currentSettings?.anniversary) {
        setSettings(currentSettings);
        const currentMemories = await getAllMemories();
        setMemories(currentMemories);
      }
      setLoading(false);
    })();
  }, []);

  const refreshData = useCallback(async () => {
    const currentSettings = await loadSettings();
    setSettings(currentSettings);
    const currentMemories = await getAllMemories();
    setMemories(currentMemories);
  }, []);

  const syncTimerRef = useRef(null);
  const syncInProgressRef = useRef(false);

  const syncNow = useCallback(async () => {
    if (!getToken()) return;
    if (syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    try {
      const result = await resolveSyncConflict();
      if (result?.resolved === 'downloaded') {
        await refreshData();
      }
    } catch (error) {
      console.warn('Auto sync failed:', error);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [refreshData]);

  useEffect(() => {
    if (!loading) {
      syncNow();
    }
  }, [loading, syncNow]);

  const scheduleAutoSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncNow();
    }, 1200);
  }, [syncNow]);

  const autoBackupNow = useCallback(async () => {
    const password = getLoginPassword();
    if (!password) return;

    setBackupStatus('saving');
    let isError = false;
    try {
      const { data } = await exportCloudBackupData();
      await uploadEncryptedBackup(data, password, { backupId: 'latest' });
      setBackupStatus('saved');
    } catch (err) {
      backupMsgRef.current = err.message || '备份失败';
      setBackupStatus('error');
      isError = true;
    }

    // 成功 4 秒消失，失败 8 秒（给你时间看清）
    setTimeout(() => setBackupStatus(null), isError ? 8000 : 4000);
  }, []);

  const scheduleAutoBackup = useCallback(() => {
    if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
    backupTimerRef.current = setTimeout(() => {
      autoBackupNow();
    }, 2000);
  }, [autoBackupNow]);

  const handleAuthSuccess = useCallback(async () => {
    setIsAuthenticated(true);
    await syncNow();
    scheduleAutoBackup();
  }, [syncNow, scheduleAutoBackup]);

  const handleLoggedOut = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const handleSetupComplete = useCallback((newSettings) => {
    setSettings(newSettings);
    setMemories([]);
    scheduleAutoSync();
    scheduleAutoBackup();
  }, [scheduleAutoSync, scheduleAutoBackup]);

  const handleDataImported = useCallback(async () => {
    await refreshData();
    scheduleAutoSync();
    scheduleAutoBackup();
  }, [refreshData, scheduleAutoSync, scheduleAutoBackup]);

  const handleMemoryAdded = useCallback(() => {
    refreshData();
    scheduleAutoSync();
    scheduleAutoBackup();
  }, [refreshData, scheduleAutoSync, scheduleAutoBackup]);

  const handleMemoryUpdated = useCallback(() => {
    refreshData();
    scheduleAutoSync();
    scheduleAutoBackup();
  }, [refreshData, scheduleAutoSync, scheduleAutoBackup]);

  const handleDelete = useCallback(async (memory) => {
    const keys = [memory?.storageKey, memory?.thumbKey].filter(Boolean);
    if (keys.length > 0) {
      await deleteFromOSS(keys);
    }
    await deleteMemory(memory.id);
    refreshData();
    scheduleAutoSync();
    scheduleAutoBackup();
  }, [refreshData, scheduleAutoSync, scheduleAutoBackup]);

  const handleMediaClick = useCallback((memory) => {
    setMediaModal(memory);
  }, []);

  const handleEdit = useCallback((memory) => {
    setEditEntry(memory);
  }, []);

  const handleEditAnniversary = useCallback(async () => {
    const currentSettings = await loadSettings();
    setShowAnniversaryEditor(currentSettings || { anniversary: '', coverUrl: '' });
  }, []);

  const handleAnniversaryUpdated = useCallback(async () => {
    await refreshData();
    setShowAnniversaryEditor(false);
    scheduleAutoSync();
    scheduleAutoBackup();
  }, [refreshData, scheduleAutoSync, scheduleAutoBackup]);

  if (loading) {
    return (
      <div className="setup-page">
        <div className="setup-card">
          <div className="setup-heart">💕</div>
          <p style={{ marginTop: 16, color: '#9b8e93' }}>加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth fullScreen={true} onAuthenticated={handleAuthSuccess} />;
  }

  if (!settings || !settings.anniversary) {
    return <SetupPage onComplete={handleSetupComplete} />;
  }

  return (
    <div className="app">
      <Header
        anniversary={settings.anniversary}
        coverUrl={settings.coverUrl}
        onDataImported={handleDataImported}
        onEditAnniversary={handleEditAnniversary}
        onAuthenticated={handleAuthSuccess}
        onLoggedOut={handleLoggedOut}
      />
      <main className="main">
        <Timeline
          memories={memories}
          anniversary={settings.anniversary}
          onMediaClick={handleMediaClick}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </main>
      <AddMemory anniversary={settings.anniversary} onAdded={handleMemoryAdded} />

      {mediaModal && (
        <MediaModal memory={mediaModal} onClose={() => setMediaModal(null)} />
      )}

      {editEntry && (
        <EditEntry
          memory={editEntry}
          anniversary={settings.anniversary}
          onClose={() => setEditEntry(null)}
          onUpdated={handleMemoryUpdated}
        />
      )}

      {showAnniversaryEditor && (
        <SetupPage
          editing={true}
          initialData={showAnniversaryEditor}
          onComplete={handleAnniversaryUpdated}
        />
      )}

      {backupStatus && (
        <div className={`backup-toast ${backupStatus === 'error' ? 'backup-toast-error' : ''}`}>
          {backupStatus === 'saving' && '☁️ 正在备份...'}
          {backupStatus === 'saved' && '✅ 云备份成功'}
          {backupStatus === 'error' && `❌ 备份失败：${backupMsgRef.current}`}
        </div>
      )}
    </div>
  );
}
