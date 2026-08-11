import { useState, useCallback, useEffect, useRef } from 'react';
import { loadSettings, getAllMemories, deleteMemory } from './utils/db';
import { deleteFromOSS } from './utils/uploader';
import { getToken } from './utils/auth';
import { resolveSyncConflict } from './utils/sync';
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

  const handleAuthSuccess = useCallback(async () => {
    setIsAuthenticated(true);
    await syncNow();
  }, [syncNow]);

  const handleLoggedOut = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const handleSetupComplete = useCallback((newSettings) => {
    setSettings(newSettings);
    setMemories([]);
    scheduleAutoSync();
  }, [scheduleAutoSync]);

  const handleDataImported = useCallback(async () => {
    await refreshData();
    scheduleAutoSync();
  }, [refreshData, scheduleAutoSync]);

  const handleMemoryAdded = useCallback(() => {
    refreshData();
    scheduleAutoSync();
  }, [refreshData, scheduleAutoSync]);

  const handleMemoryUpdated = useCallback(() => {
    refreshData();
    scheduleAutoSync();
  }, [refreshData, scheduleAutoSync]);

  const handleDelete = useCallback(async (memory) => {
    const keys = [memory?.storageKey, memory?.thumbKey].filter(Boolean);
    if (keys.length > 0) {
      await deleteFromOSS(keys);
    }
    await deleteMemory(memory.id);
    refreshData();
    scheduleAutoSync();
  }, [refreshData, scheduleAutoSync]);

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
  }, [refreshData, scheduleAutoSync]);

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
    </div>
  );
}
