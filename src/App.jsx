import { useState, useCallback, useEffect } from 'react';
import { loadSettings, getAllMemories, deleteMemory } from './utils/db';
import { deleteFromOSS } from './utils/uploader';
import LockScreen from './components/LockScreen';
import SetupPage from './components/SetupPage';
import Header from './components/Header';
import Timeline from './components/Timeline';
import AddMemory from './components/AddMemory';
import MediaModal from './components/MediaModal';
import EditEntry from './components/EditEntry';
import './App.css';

export default function App() {
  const [locked, setLocked] = useState(() => !localStorage.getItem('love-timeline-unlocked'));
  const [settings, setSettings] = useState(null);
  const [memories, setMemories] = useState([]);
  const [mediaModal, setMediaModal] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [showAnniversaryEditor, setShowAnniversaryEditor] = useState(false);
  const [loading, setLoading] = useState(true);

  // 初始化加载
  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      if (s?.anniversary) {
        setSettings(s);
        const m = await getAllMemories();
        setMemories(m);
      }
      setLoading(false);
    })();
  }, []);

  const refreshData = useCallback(async () => {
    const s = await loadSettings();
    setSettings(s);
    const m = await getAllMemories();
    setMemories(m);
  }, []);

  const handleSetupComplete = useCallback((newSettings) => {
    setSettings(newSettings);
    setMemories([]);
  }, []);

  const handleDataImported = useCallback(async (data) => {
    await refreshData();
  }, [refreshData]);

  const handleMemoryAdded = useCallback(() => {
    refreshData();
  }, [refreshData]);

  const handleMemoryUpdated = useCallback(() => {
    refreshData();
  }, [refreshData]);

  const handleDelete = useCallback(async (memory) => {
    const keys = [memory?.storageKey, memory?.thumbKey].filter(Boolean);
    if (keys.length > 0) {
      await deleteFromOSS(keys);
    }
    await deleteMemory(memory.id);
    refreshData();
  }, [refreshData]);

  const handleMediaClick = useCallback((memory) => {
    setMediaModal(memory);
  }, []);

  const handleEdit = useCallback((memory) => {
    setEditEntry(memory);
  }, []);

  const handleEditAnniversary = useCallback(async () => {
    const s = await loadSettings();
    setShowAnniversaryEditor(s || { anniversary: '', coverUrl: '' });
  }, []);

  const handleAnniversaryUpdated = useCallback(async () => {
    await refreshData();
    setShowAnniversaryEditor(false);
  }, [refreshData]);

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

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

  // 首次使用
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
      <AddMemory
        anniversary={settings.anniversary}
        onAdded={handleMemoryAdded}
      />

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
