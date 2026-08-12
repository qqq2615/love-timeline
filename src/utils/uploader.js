import { generatePresignedUrl } from './oss-signer';
import { deleteBlob } from './db';
import { API_BASE } from './config';
import { getToken } from './auth';

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
  } catch {
    await Promise.all(remoteKeys.map((key) => deleteBlob(key).catch(() => undefined)));
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
