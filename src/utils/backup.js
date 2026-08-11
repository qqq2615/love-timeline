// Client-side encryption helpers and backup upload/download
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
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

import { API_BASE } from './config';

async function deriveKey(password, salt) {
  const pwKey = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt || ''), iterations: 150000, hash: 'SHA-256' },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return key;
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

export async function uploadEncryptedBackup(dataObj, username, password) {
  const salt = username || '';
  const payload = await encryptObject(dataObj, password, salt);
  const body = { name: username || '', data: payload };
  const token = localStorage.getItem('love-timeline-jwt');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/backup`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('上传备份失败');
  const j = await res.json();
  return j.id;
}

export async function downloadAndDecryptBackup(id, username, password) {
  const token = localStorage.getItem('love-timeline-jwt');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/backup/${id}`, { headers });
  if (!res.ok) throw new Error('下载备份失败');
  const j = await res.json();
  const payload = j.data;
  const obj = await decryptObject(payload, password, username || '');
  return obj;
}

export async function listBackups() {
  const token = localStorage.getItem('love-timeline-jwt');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/backups`, { headers });
  if (!res.ok) throw new Error('获取备份列表失败');
  const j = await res.json();
  return j.list || [];
}

export async function deleteBackup(id) {
  const token = localStorage.getItem('love-timeline-jwt');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/backup/${id}`, { method: 'DELETE', headers });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || '删除备份失败');
  }
  return true;
}

export async function encryptForExportOnly(dataObj, username, password) {
  return await encryptObject(dataObj, password, username || '');
}

export async function decryptFromImport(encPayload, username, password) {
  return await decryptObject(encPayload, password, username || '');
}

export default { uploadEncryptedBackup, downloadAndDecryptBackup };
