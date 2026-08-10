import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHmac } from 'crypto';
import dotenv from 'dotenv';
import OSS from 'ali-oss';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

function urlEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function buildPresignedUploadUrl({ fileName, contentType, prefix = 'photos' }) {
  const region = process.env.OSS_REGION || 'oss-cn-shenzhen';
  const bucket = process.env.OSS_BUCKET || 'love-timeline';
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET || '';
  const customDomain = process.env.OSS_CUSTOM_DOMAIN || '';

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('OSS 凭证未配置，请在环境变量中设置 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET');
  }

  const ext = fileName.split('.').pop().toLowerCase();
  const uuid = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const key = `${prefix}/${uuid}.${ext}`;
  const expires = Math.floor(Date.now() / 1000) + 300;
  const resource = `/${bucket}/${key}`;

  const stringToSign = [
    'PUT',
    '',
    contentType,
    expires.toString(),
    '',
    resource,
  ].join('\n');

  const signature = createHmac('sha1', accessKeySecret)
    .update(stringToSign)
    .digest('base64');
  const encodedSig = urlEncode(signature);

  const uploadUrl = `https://${bucket}.${region}.aliyuncs.com/${key}`
    + `?OSSAccessKeyId=${accessKeyId}`
    + `&Expires=${expires}`
    + `&Signature=${encodedSig}`;

  const publicUrl = customDomain
    ? `https://${customDomain}/${key}`
    : `https://${bucket}.${region}.aliyuncs.com/${key}`;

  return { uploadUrl, publicUrl, key };
}

app.post('/api/oss-token', (req, res) => {
  try {
    const { fileName, contentType, prefix = 'photos' } = req.body || {};

    if (!fileName || !contentType) {
      res.status(400).json({ error: 'Missing fileName or contentType' });
      return;
    }

    const result = buildPresignedUploadUrl({ fileName, contentType, prefix });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/oss-delete', async (req, res) => {
  try {
    const { keys = [] } = req.body || {};
    if (!Array.isArray(keys) || keys.length === 0) {
      res.json({ ok: true });
      return;
    }

    const client = new OSS({
      region: process.env.OSS_REGION || 'oss-cn-shenzhen',
      bucket: process.env.OSS_BUCKET || 'love-timeline',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    });

    await Promise.all(keys.map((key) => client.delete(key)));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`OSS upload server listening on http://0.0.0.0:${port}`);
});
