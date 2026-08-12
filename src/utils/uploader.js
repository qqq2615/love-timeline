import { generatePresignedUrl } from './oss-signer';
import { getSpaceId, getToken, getUsername } from './auth';
import { saveBlob, deleteBlob } from './db';
import { generateId } from './dateUtils';
import { API_BASE } from './config';

function buildUploadErrorMessage(error) {
  const message = error?.message || '';

  if (message.includes('413')) {
    return '文件过大，上传被服务器拒绝。请压缩后重试。';
  }

  if (message.includes('403')) {
    return '上传凭证失效或 OSS 权限不足，请稍后重试。';
  }

  if (message.includes('Network') || message.includes('网络')) {
    return '网络异常，媒体上传失败。';
  }

  return message || '媒体上传失败';
}

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
    console.warn('Remote media upload failed, using local fallback:', error);

    const ext = fileName.split('.').pop() || 'bin';
    const scope = getSpaceId() || getUsername();
    const localPrefix = scope
      ? `${scope.replace(/[^a-zA-Z0-9_-]/g, '_')}/${prefix}`
      : prefix;
    const localKey = `${localPrefix}/${generateId()}.${ext}`;

    try {
      await saveBlob(localKey, blob);
      return {
        url: await blobToDataUrl(blob),
        key: localKey,
        storageMode: 'local',
        uploadError: buildUploadErrorMessage(error),
      };
    } catch {
      return {
        url: await blobToDataUrl(blob),
        key: null,
        storageMode: 'local',
        uploadError: buildUploadErrorMessage(error),
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
  if (!Array.isArray(keys) || keys.length === 0) {
    return;
  }

  const localKeys = keys.filter(Boolean);
  if (localKeys.length === 0) {
    return;
  }

  await Promise.all(localKeys.map((key) => deleteBlob(key).catch(() => undefined)));

  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/api/oss-delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ keys: localKeys }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '删除 OSS 文件失败');
    }
  } catch {
    // Local-only media or a temporary network failure must not block the main flow.
  }
}

function putWithProgress(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`上传失败: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.ontimeout = () => reject(new Error('上传超时'));
    xhr.send(blob);
  });
}
