import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHmac, randomBytes } from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
import OSS from 'ali-oss';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// helper for OSS client and backup prefix
function getOSSClient() {
  return new OSS({
    region: process.env.OSS_REGION || 'oss-cn-shenzhen',
    bucket: process.env.OSS_BUCKET || 'love-timeline',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  });
}

function getUserPrefix(username) {
  return username.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getBackupKey(username, id) {
  const userPrefix = getUserPrefix(username);
  return `backups/${userPrefix}/${id}.json`;
}

// Users storage
const USERS_FILE = path.join(__dirname, 'users.json');
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) || {};
  } catch (e) {
    return {};
  }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
    const users = loadUsers();
    if (users[username]) return res.status(409).json({ error: 'Username exists' });
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    users[username] = { username, hash, createdAt: Date.now() };
    saveUsers(users);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
    const users = loadUsers();
    const u = users[username];
    if (!u) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, u.hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

app.post('/api/oss-token', authMiddleware, (req, res) => {
  try {
    const { fileName, contentType, prefix = 'photos' } = req.body || {};

    if (!fileName || !contentType) {
      res.status(400).json({ error: 'Missing fileName or contentType' });
      return;
    }

    const userPrefix = req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    const combinedPrefix = `${userPrefix}/${prefix}`;
    const result = buildPresignedUploadUrl({ fileName, contentType, prefix: combinedPrefix });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/oss-delete', authMiddleware, async (req, res) => {
  try {
    const { keys = [] } = req.body || {};
    if (!Array.isArray(keys) || keys.length === 0) {
      res.json({ ok: true });
      return;
    }

    const userPrefix = req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    const invalidKey = keys.find((key) => typeof key !== 'string' || !key.startsWith(`${userPrefix}/`));
    if (invalidKey) {
      return res.status(403).json({ error: 'Cannot delete keys outside your user namespace' });
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

// POST /api/backup  -- store encrypted backup blob (JSON { name, data })
app.post('/api/backup', authMiddleware, async (req, res) => {
  try {
    const { name, data } = req.body || {};
    if (!data) return res.status(400).json({ error: 'Missing data' });

    const id = Date.now().toString(36) + '-' + randomBytes(6).toString('hex');
    const key = getBackupKey(req.user.username, id);
    const client = getOSSClient();
    const body = JSON.stringify({ name: name || '', data, username: req.user.username });

    await client.put(key, Buffer.from(body, 'utf8'), { headers: { 'Content-Type': 'application/json' } });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backup/:id -- retrieve backup blob
app.get('/api/backup/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const key = getBackupKey(req.user.username, id);
    const client = getOSSClient();
    const result = await client.get(key);
    const parsed = JSON.parse(result.content.toString('utf8'));
    if (parsed.username !== req.user.username) return res.status(403).json({ error: 'Forbidden' });
    res.json(parsed);
  } catch (err) {
    if (err.name === 'NoSuchKeyError' || err.code === 'NoSuchKey') {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

// List user's backups
app.get('/api/backups', authMiddleware, async (req, res) => {
  try {
    const userPrefix = getUserPrefix(req.user.username);
    const client = getOSSClient();
    const listRes = await client.list({ prefix: `backups/${userPrefix}/` });
    const objects = listRes.objects || [];
    const list = objects.map((obj) => {
      const id = obj.name.replace(`backups/${userPrefix}/`, '').replace(/\.json$/, '');
      return {
        id,
        name: obj.name,
        createdAt: new Date(obj.lastModified).getTime(),
      };
    });
    res.json({ list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/backup/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const key = getBackupKey(req.user.username, id);
    const client = getOSSClient();
    await client.delete(key);
    res.json({ ok: true });
  } catch (err) {
    if (err.name === 'NoSuchKeyError' || err.code === 'NoSuchKey') {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync', authMiddleware, async (req, res) => {
  try {
    const { data } = req.body || {};
    if (!data) return res.status(400).json({ error: 'Missing data' });

    const userPrefix = getUserPrefix(req.user.username);
    const key = `sync/${userPrefix}/latest.json`;
    const client = getOSSClient();
    const payload = JSON.stringify({ data, updatedAt: new Date().toISOString(), username: req.user.username });

    await client.put(key, Buffer.from(payload, 'utf8'), { headers: { 'Content-Type': 'application/json' } });
    res.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync', authMiddleware, async (req, res) => {
  try {
    const userPrefix = getUserPrefix(req.user.username);
    const key = `sync/${userPrefix}/latest.json`;
    const client = getOSSClient();
    const result = await client.get(key);
    const parsed = JSON.parse(result.content.toString('utf8'));
    if (parsed.username !== req.user.username) return res.status(403).json({ error: 'Forbidden' });
    res.json({ data: parsed.data, updatedAt: parsed.updatedAt });
  } catch (err) {
    if (err.name === 'NoSuchKeyError' || err.code === 'NoSuchKey') {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync/info', authMiddleware, async (req, res) => {
  try {
    const userPrefix = getUserPrefix(req.user.username);
    const key = `sync/${userPrefix}/latest.json`;
    const client = getOSSClient();
    const listRes = await client.list({ prefix: key });
    const obj = (listRes.objects || [])[0];
    if (!obj) return res.json({ exists: false });
    res.json({ exists: true, updatedAt: obj.lastModified });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
