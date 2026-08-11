import { exportAllData, importAllData } from './db';
import { getToken, getUsername } from './auth';
import { API_BASE } from './config';

const metaKey = 'love-timeline-sync-meta';

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = sortObject(value[key]);
      return result;
    }, {});
  }
  return value;
}

async function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

async function hashString(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getAuthHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function getSyncInfo() {
  const res = await fetch(`${API_BASE}/api/sync/info`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('获取同步信息失败');
  return await res.json();
}

export async function downloadSyncData() {
  const res = await fetch(`${API_BASE}/api/sync`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('下载同步数据失败');
  return await res.json();
}

export async function uploadSyncData(data) {
  const res = await fetch(`${API_BASE}/api/sync`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error('上传同步数据失败');
  return await res.json();
}

export function getSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(metaKey) || '{}');
  } catch {
    return {};
  }
}

export function setSyncMeta(meta) {
  localStorage.setItem(metaKey, JSON.stringify(meta));
}

export async function getSnapshotHash() {
  const data = await exportAllData();
  const raw = await stableStringify(data);
  return hashString(raw);
}

export async function pullRemoteData() {
  const remote = await downloadSyncData();
  if (!remote?.data) throw new Error('远程同步数据为空');
  await importAllData(remote.data);
  const hash = await getSnapshotHash();
  setSyncMeta({
    lastLocalHash: hash,
    lastRemoteHash: hash,
    lastRemoteUpdated: remote.updatedAt || new Date().toISOString(),
  });
  return remote;
}

export async function pushLocalData() {
  const data = await exportAllData();
  const localHash = await hashString(await stableStringify(data));
  const result = await uploadSyncData(data);
  setSyncMeta({
    lastLocalHash: localHash,
    lastRemoteHash: localHash,
    lastRemoteUpdated: result.updatedAt || new Date().toISOString(),
  });
  return result;
}

export async function resolveSyncConflict() {
  const meta = getSyncMeta();
  const remoteInfo = await getSyncInfo();
  const remoteUpdated = remoteInfo.updatedAt ? new Date(remoteInfo.updatedAt).getTime() : null;
  const localHash = await getSnapshotHash();

  if (!remoteUpdated) {
    await pushLocalData();
    return { resolved: 'uploaded' };
  }

  const localChanged = meta.lastLocalHash && localHash !== meta.lastLocalHash;
  const remoteChanged = meta.lastRemoteUpdated && remoteUpdated > new Date(meta.lastRemoteUpdated).getTime();

  if (!meta.lastLocalHash && !meta.lastRemoteUpdated) {
    const useRemote = confirm('检测到云端已有同步数据，是否优先恢复云端数据？取消则会将本地数据上传覆盖云端。');
    if (useRemote) {
      await pullRemoteData();
      return { resolved: 'downloaded' };
    }
    await pushLocalData();
    return { resolved: 'uploaded' };
  }

  if (localChanged && remoteChanged) {
    const useRemote = confirm('检测到云端与本地均有更新，是否从云端恢复？(确定=云端，取消=本地覆盖云端)');
    if (useRemote) {
      await pullRemoteData();
      return { resolved: 'downloaded' };
    }
    await pushLocalData();
    return { resolved: 'uploaded' };
  }

  if (localChanged) {
    await pushLocalData();
    return { resolved: 'uploaded' };
  }

  if (remoteChanged) {
    await pullRemoteData();
    return { resolved: 'downloaded' };
  }

  return { resolved: 'none' };
}

export async function getCurrentSyncUser() {
  return getUsername();
}
