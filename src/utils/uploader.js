/**
 * 媒体上传器
 * 优先使用 OSS；如果不可用则自动回退到本地 IndexedDB，确保手机端可独立使用。
 */
import { generatePresignedUrl } from './oss-signer';
import { getUsername } from './auth';
import { saveBlob, deleteBlob } from './db';
import { generateId } from './dateUtils';
import { API_BASE } from './config';

export async function uploadToOSS(blob, fileName, prefix = 'photos', onProgress) {
  try {
    const { uploadUrl, publicUrl, key } = await generatePresignedUrl(
      fileName,
      blob.type || 'application/octet-stream',
      prefix
    );
    await putWithProgress(uploadUrl, blob, onProgress);
    return { url: publicUrl, key, storageMode: 'remote' };
  } catch (error) {
    const ext = fileName.split('.').pop() || 'bin';
    const user = getUsername();
    const localPrefix = user ? `${user.replace(/[^a-zA-Z0-9_-]/g, '_')}/${prefix}` : prefix;
    const localKey = `${localPrefix}/${generateId()}.${ext}`;
    let localUrl;
    try {
      await saveBlob(localKey, blob);
      localUrl = await blobToDataUrl(blob);
      return {
        url: localUrl,
        key: localKey,
        storageMode: 'local',
      };
    } catch (saveError) {
      localUrl = await blobToDataUrl(blob);
      return {
        url: localUrl,
        key: null,
        storageMode: 'local',
      };
    }
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取本地文件失败'));
    reader.readAsDataURL(blob);
  });
}

export async function deleteFromOSS(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return;

  const localKeys = keys.filter(Boolean);
  await Promise.all(localKeys.map((key) => deleteBlob(key)));

  try {
    const response = await fetch(`${API_BASE}/api/oss-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: localKeys }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '删除 OSS 文件失败');
    }
  } catch {
    // 本地模式下无需报错
  }
}

function putWithProgress(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`上传失败: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.ontimeout = () => reject(new Error('上传超时'));
    xhr.send(blob);
  });
}
