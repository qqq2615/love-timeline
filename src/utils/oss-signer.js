/**
 * OSS 预签名 URL 生成器
 * 前端只负责请求服务端签名，不再把 OSS Secret 暴露给浏览器。
 */

export async function generatePresignedUrl(fileName, contentType, prefix = 'photos') {
  const response = await fetch('/api/oss-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
