/**
 * IndexedDB 封装 — 替代 localStorage
 * 数据库: love-timeline
 * 表: settings (1条), memories (多条)
 */

const DB_NAME = 'love-timeline';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('memories')) {
        const store = db.createObjectStore('memories', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(db, storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ========== Settings ==========

export async function loadSettings() {
  const db = await openDB();
  const store = tx(db, 'settings');
  return promisify(store.get('main'));
}

export async function saveSettings(settings) {
  const db = await openDB();
  const store = tx(db, 'settings', 'readwrite');
  return promisify(store.put({ id: 'main', ...settings }));
}

// ========== Memories ==========

export async function getAllMemories() {
  const db = await openDB();
  const store = tx(db, 'memories');
  const memories = await promisify(store.getAll());

  const hydrated = await Promise.all(memories.map(async (memory) => {
    const hydratedMemory = { ...memory };

    if (hydratedMemory.storageMode === 'local') {
      if (hydratedMemory.storageKey) {
        const mainBlob = await getBlob(hydratedMemory.storageKey);
        if (mainBlob) {
          hydratedMemory.url = URL.createObjectURL(mainBlob);
        }
      }
      if (hydratedMemory.thumbKey) {
        const thumbBlob = await getBlob(hydratedMemory.thumbKey);
        if (thumbBlob) {
          hydratedMemory.thumbUrl = URL.createObjectURL(thumbBlob);
        }
      }
    }

    return hydratedMemory;
  }));

  // 按日期降序
  return hydrated.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function addMemory(memory) {
  const db = await openDB();
  const store = tx(db, 'memories', 'readwrite');
  return promisify(store.add(memory));
}

export async function updateMemory(id, updates) {
  const db = await openDB();
  const store = tx(db, 'memories', 'readwrite');
  const existing = await promisify(store.get(id));
  if (!existing) throw new Error('记录不存在');
  return promisify(store.put({ ...existing, ...updates }));
}

export async function deleteMemory(id) {
  const db = await openDB();
  const store = tx(db, 'memories', 'readwrite');
  const existing = await promisify(store.get(id));
  if (existing?.storageKey) await deleteBlob(existing.storageKey);
  if (existing?.thumbKey) await deleteBlob(existing.thumbKey);
  return promisify(store.delete(id));
}

// ========== 导入导出 ==========

export async function exportAllData() {
  const settings = await loadSettings();
  const memories = await getAllMemories();
  return { settings, memories };
}

export async function importAllData(data) {
  const db = await openDB();
  if (data.settings) {
    const store = tx(db, 'settings', 'readwrite');
    await promisify(store.put({ id: 'main', ...data.settings }));
  }
  if (data.memories?.length) {
    const store = tx(db, 'memories', 'readwrite');
    for (const m of data.memories) {
      await promisify(store.put(m));
    }
  }
}

export async function clearAllData() {
  const db = await openDB();
  await promisify(tx(db, 'settings', 'readwrite').clear());
  await promisify(tx(db, 'memories', 'readwrite').clear());
  await promisify(tx(db, 'blobs', 'readwrite').clear());
}

async function readBlobData(blob) {
  if (blob.arrayBuffer) {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function saveBlob(id, blob) {
  const db = await openDB();
  const store = tx(db, 'blobs', 'readwrite');
  const data = await readBlobData(blob);
  return promisify(store.put({ id, type: blob.type, data }));
}

export async function getBlob(id) {
  const db = await openDB();
  const store = tx(db, 'blobs');
  const result = await promisify(store.get(id));
  if (!result?.data) return null;
  return new Blob([result.data], { type: result.type });
}

export async function deleteBlob(id) {
  if (!id) return;
  const db = await openDB();
  const store = tx(db, 'blobs', 'readwrite');
  return promisify(store.delete(id));
}

// ========== 下载/上传 JSON ==========

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch (err) {
        reject(new Error('JSON 解析失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}
