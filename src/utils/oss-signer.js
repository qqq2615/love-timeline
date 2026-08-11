/**
 * OSS 预签名 URL 生成器
 * 前端只负责请求服务端签名，不再把 OSS Secret 暴露给浏览器。
 */

import { API_BASE } from './config';

export async function generatePresignedUrl(fileName, contentType, prefix = 'photos') {
  const token = localStorage.getItem('love-timeline-jwt');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/oss-token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fileName, contentType, prefix }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || '获取上传凭证失败');
  }

  return {
    uploadUrl: data.uploadUrl,
    publicUrl: data.publicUrl,
    key: data.key,
  };
}
