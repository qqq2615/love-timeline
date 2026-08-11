import { API_BASE } from './config';
import { getSpaceId, getSpaceLabel, getToken } from './auth';

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(buf) {
  const bin = String.fromCharCode(...new Uint8Array(buf));
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(password, salt) {
  const pwKey = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt || ''), iterations: 150000, hash: 'SHA-256' },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptObject(obj, password, salt) {
  const raw = enc.encode(JSON.stringify(obj));
  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, raw);
  return {
    iv: toBase64(iv.buffer),
    ciphertext: toBase64(ct),
  };
}

async function decryptObject(encObj, password, salt) {
  const key = await deriveKey(password, salt);
  const iv = fromBase64(encObj.iv);
  const ct = fromBase64(encObj.ciphertext);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, ct);
  return JSON.parse(dec.decode(plain));
}

function getAuthHeaders(json = false) {
  const headers = json ? { 'Content-Type': 'application/json' } : {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function resolveBackupPassword(usernameOrPassword, maybePassword) {
  return typeof maybePassword === 'string' ? maybePassword : usernameOrPassword;
}

function resolveLegacySalt(usernameOrPassword, maybePassword) {
  return typeof maybePassword === 'string' ? usernameOrPassword || '' : '';
}

export async function uploadEncryptedBackup(dataObj, usernameOrPassword, maybePassword) {
  const backupPassword = resolveBackupPassword(usernameOrPassword, maybePassword);
  const legacySalt = resolveLegacySalt(usernameOrPassword, maybePassword);
  const spaceId = getSpaceId() || '';
  const salt = spaceId || legacySalt;

  if (!backupPassword) {
    throw new Error('需要输入备份口令');
  }

  const payload = await encryptObject(dataObj, backupPassword, salt);
  const body = {
    name: getSpaceLabel() || '',
    data: payload,
    saltVersion: spaceId ? 'space-id' : 'legacy-user',
    spaceId,
  };

  const res = await fetch(`${API_BASE}/api/backup`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error('上传备份失败');
  }

  const json = await res.json();
  return json.id;
}

export async function downloadAndDecryptBackup(id, usernameOrPassword, maybePassword) {
  const backupPassword = resolveBackupPassword(usernameOrPassword, maybePassword);
  const legacySalt = resolveLegacySalt(usernameOrPassword, maybePassword);

  if (!backupPassword) {
    throw new Error('需要输入备份口令');
  }

  const res = await fetch(`${API_BASE}/api/backup/${id}`, {
    headers: getAuthHeaders(false),
  });

  if (!res.ok) {
    throw new Error('下载备份失败');
  }

  const json = await res.json();
  const payload = json.data;
  const saltCandidates = [
    json.spaceId,
    getSpaceId(),
    legacySalt,
    getSpaceLabel(),
    '',
  ].filter((value, index, array) => value !== undefined && value !== null && array.indexOf(value) === index);

  let lastError = null;
  for (const salt of saltCandidates) {
    try {
      return await decryptObject(payload, backupPassword, salt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('备份解密失败');
}

export async function listBackups() {
  const res = await fetch(`${API_BASE}/api/backups`, {
    headers: getAuthHeaders(false),
  });

  if (!res.ok) {
    throw new Error('获取备份列表失败');
  }

  const json = await res.json();
  return json.list || [];
}

export async function deleteBackup(id) {
  const res = await fetch(`${API_BASE}/api/backup/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(false),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || '删除备份失败');
  }

  return true;
}

export async function encryptForExportOnly(dataObj, usernameOrPassword, maybePassword) {
  const backupPassword = resolveBackupPassword(usernameOrPassword, maybePassword);
  const legacySalt = resolveLegacySalt(usernameOrPassword, maybePassword);
  return encryptObject(dataObj, backupPassword, getSpaceId() || legacySalt);
}

export async function decryptFromImport(encPayload, usernameOrPassword, maybePassword) {
  const backupPassword = resolveBackupPassword(usernameOrPassword, maybePassword);
  const legacySalt = resolveLegacySalt(usernameOrPassword, maybePassword);
  return decryptObject(encPayload, backupPassword, getSpaceId() || legacySalt);
}

export default {
  uploadEncryptedBackup,
  downloadAndDecryptBackup,
  listBackups,
  deleteBackup,
};
