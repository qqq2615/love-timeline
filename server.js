import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHmac, randomBytes } from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
import OSS from 'ali-oss';
import jwt from 'jsonwebtoken';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_OSS_REGION = 'oss-cn-shenzhen';
const DEFAULT_OSS_BUCKET = 'love-timeline';
const DEFAULT_SPACE_ID = 'our-love-space';
const DEFAULT_SPACE_LABEL = 'Our Love Space';
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://qqq2615.github.io',
];

const OSS_REGION = process.env.OSS_REGION || DEFAULT_OSS_REGION;
const OSS_BUCKET = process.env.OSS_BUCKET || DEFAULT_OSS_BUCKET;
const OSS_ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_CUSTOM_DOMAIN = process.env.OSS_CUSTOM_DOMAIN || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const SPACE_ID = process.env.SPACE_ID || DEFAULT_SPACE_ID;
const SPACE_LABEL = process.env.SPACE_LABEL || DEFAULT_SPACE_LABEL;

function sanitizeKeySegment(value) {
  return String(value || DEFAULT_SPACE_ID).replace(/[^a-zA-Z0-9_-]/g, '_');
}

const SPACE_PREFIX = sanitizeKeySegment(SPACE_ID);

const app = express();
app.use(express.json());

function parseCorsOrigins(value) {
  if (!value) return DEFAULT_CORS_ORIGINS;
  if (value.trim() === '*') return '*';
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins === '*') {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
}));

function getOSSClient() {
  return new OSS({
    region: OSS_REGION,
    bucket: OSS_BUCKET,
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
  });
}

function requireOSSConfig() {
  if (!OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET) {
    throw new Error('OSS credentials are not configured');
  }
}

function getBackupKey(id) {
  return `backups/${SPACE_PREFIX}/${id}.json`;
}

function getSyncKey() {
  return `sync/${SPACE_PREFIX}/latest.json`;
}

function getScopedPrefix(prefix = 'photos') {
  return `${SPACE_PREFIX}/${prefix}`;
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth' });
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.spaceId !== SPACE_PREFIX) {
      return res.status(401).json({ error: 'Invalid space token' });
    }
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'love-timeline-api',
    spaceId: SPACE_PREFIX,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/register', (req, res) => {
  res.status(410).json({ error: 'Registration is disabled for this shared space' });
});

app.post('/api/login', (req, res) => {
  try {
    const { password } = req.body || {};
    if (!APP_PASSWORD) {
      return res.status(500).json({ error: 'APP_PASSWORD is not configured' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    if (password !== APP_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ spaceId: SPACE_PREFIX }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      username: SPACE_LABEL,
      spaceId: SPACE_PREFIX,
      spaceLabel: SPACE_LABEL,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function urlEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function buildPresignedUploadUrl({ fileName, contentType, prefix = 'photos' }) {
  requireOSSConfig();

  const ext = (fileName.split('.').pop() || 'bin').toLowerCase();
  const uuid = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const key = `${prefix}/${uuid}.${ext}`;
  const expires = Math.floor(Date.now() / 1000) + 300;
  const resource = `/${OSS_BUCKET}/${key}`;

  const stringToSign = [
    'PUT',
    '',
    contentType,
    expires.toString(),
    '',
    resource,
  ].join('\n');

  const signature = createHmac('sha1', OSS_ACCESS_KEY_SECRET)
    .update(stringToSign)
    .digest('base64');
  const encodedSig = urlEncode(signature);

  const uploadUrl = `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com/${key}`
    + `?OSSAccessKeyId=${OSS_ACCESS_KEY_ID}`
    + `&Expires=${expires}`
    + `&Signature=${encodedSig}`;

  const publicUrl = OSS_CUSTOM_DOMAIN
    ? `https://${OSS_CUSTOM_DOMAIN}/${key}`
    : `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com/${key}`;

  return { uploadUrl, publicUrl, key };
}

app.post('/api/oss-token', authMiddleware, (req, res) => {
  try {
    const { fileName, contentType, prefix = 'photos' } = req.body || {};
    if (!fileName || !contentType) {
      return res.status(400).json({ error: 'Missing fileName or contentType' });
    }

    const result = buildPresignedUploadUrl({
      fileName,
      contentType,
      prefix: getScopedPrefix(prefix),
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/oss-delete', authMiddleware, async (req, res) => {
  try {
    requireOSSConfig();
    const { keys = [] } = req.body || {};
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.json({ ok: true });
    }

    const invalidKey = keys.find((key) => typeof key !== 'string' || !key.startsWith(`${SPACE_PREFIX}/`));
    if (invalidKey) {
      return res.status(403).json({ error: 'Cannot delete keys outside the shared space' });
    }

    const client = getOSSClient();
    await Promise.all(keys.map((key) => client.delete(key)));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backup', authMiddleware, async (req, res) => {
  try {
    requireOSSConfig();
    const { name, data } = req.body || {};
    if (!data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const id = Date.now().toString(36) + '-' + randomBytes(6).toString('hex');
    const key = getBackupKey(id);
    const client = getOSSClient();
    const body = JSON.stringify({
      name: name || SPACE_LABEL,
      data,
      spaceId: SPACE_PREFIX,
    });

    await client.put(key, Buffer.from(body, 'utf8'), {
      headers: { 'Content-Type': 'application/json' },
    });
    res.json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/backup/:id', authMiddleware, async (req, res) => {
  try {
    requireOSSConfig();
    const key = getBackupKey(req.params.id);
    const client = getOSSClient();
    const result = await client.get(key);
    const parsed = JSON.parse(result.content.toString('utf8'));

    if (parsed.spaceId !== SPACE_PREFIX) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(parsed);
  } catch (error) {
    if (error.name === 'NoSuchKeyError' || error.code === 'NoSuchKey') {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/backups', authMiddleware, async (req, res) => {
  try {
    requireOSSConfig();
    const client = getOSSClient();
    const prefix = `backups/${SPACE_PREFIX}/`;
    const listRes = await client.list({ prefix });
    const objects = listRes.objects || [];
    const list = objects.map((obj) => ({
      id: obj.name.replace(prefix, '').replace(/\.json$/, ''),
      name: obj.name,
      createdAt: new Date(obj.lastModified).getTime(),
    }));
    res.json({ list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/backup/:id', authMiddleware, async (req, res) => {
  try {
    requireOSSConfig();
    const client = getOSSClient();
    await client.delete(getBackupKey(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    if (error.name === 'NoSuchKeyError' || error.code === 'NoSuchKey') {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync', authMiddleware, async (req, res) => {
  try {
    requireOSSConfig();
    const { data } = req.body || {};
    if (!data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const key = getSyncKey();
    const updatedAt = new Date().toISOString();
    const payload = JSON.stringify({
      data,
      updatedAt,
      spaceId: SPACE_PREFIX,
    });

    await getOSSClient().put(key, Buffer.from(payload, 'utf8'), {
      headers: { 'Content-Type': 'application/json' },
    });
    res.json({ ok: true, updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sync', authMiddleware, async (req, res) => {
  try {
    requireOSSConfig();
    const result = await getOSSClient().get(getSyncKey());
    const parsed = JSON.parse(result.content.toString('utf8'));

    if (parsed.spaceId !== SPACE_PREFIX) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ data: parsed.data, updatedAt: parsed.updatedAt });
  } catch (error) {
    if (error.name === 'NoSuchKeyError' || error.code === 'NoSuchKey') {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sync/info', authMiddleware, async (req, res) => {
  try {
    requireOSSConfig();
    const client = getOSSClient();
    const key = getSyncKey();
    const listRes = await client.list({ prefix: key });
    const obj = (listRes.objects || [])[0];
    if (!obj) {
      return res.json({ exists: false });
    }
    res.json({ exists: true, updatedAt: obj.lastModified });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const distDir = path.join(__dirname, 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`OSS upload server listening on http://${host}:${port}`);
});
