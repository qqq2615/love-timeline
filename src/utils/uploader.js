import { getToken } from './auth';
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
  const token = getToken();
  if (!token) {
    throw new Error('请先登录后再上传媒体');
  }

  const params = new URLSearchParams({
    prefix,
    fileName,
  });

  try {
    const result = await uploadWithProgress(
      `${API_BASE}/api/media/upload?${params.toString()}`,
      blob,
      token,
      onProgress
    );

    return { url: result.url, key: result.key, storageMode: 'remote' };
  } catch (error) {
    throw new Error(buildUploadErrorMessage(error));
  }
}

export async function deleteFromOSS(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return;
  }

  const remoteKeys = keys.filter(Boolean);
  if (remoteKeys.length === 0) {
    return;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/api/oss-delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ keys: remoteKeys }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '删除 OSS 文件失败');
    }
  } catch (error) {
    console.warn('Failed to delete remote media:', error);
  }
}

function uploadWithProgress(url, blob, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }

      reject(new Error(data.error || `上传失败: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.ontimeout = () => reject(new Error('上传超时'));
    xhr.send(blob);
  });
}
