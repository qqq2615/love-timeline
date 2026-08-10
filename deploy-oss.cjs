/**
 * OSS 静态网站部署脚本
 * 用法: node deploy-oss.cjs
 * 把 dist/ 目录上传到 OSS bucket 根目录，设置 public-read
 */

const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DIST = path.join(__dirname, 'dist');

const client = new OSS({
  region: process.env.OSS_REGION || 'oss-cn-shenzhen',
  bucket: process.env.OSS_BUCKET || 'love-timeline',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function walkDir(dir, base = '') {
  const entries = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    const key = base + (base ? '/' : '') + item.name;
    if (item.isDirectory()) {
      entries.push(...walkDir(full, key));
    } else {
      entries.push({ filePath: full, key });
    }
  }
  return entries;
}

async function deploy() {
  const files = walkDir(DIST);
  console.log(`共 ${files.length} 个文件待上传\n`);

  for (let i = 0; i < files.length; i++) {
    const { filePath, key } = files[i];
    const body = fs.readFileSync(filePath);
    const mime = getMime(filePath);
    try {
      await client.put(key, body, {
        headers: { 'Content-Type': mime },
        meta: { 'Cache-Control': mime.includes('html') ? 'no-cache' : 'public, max-age=31536000' },
      });
      // 设置公开读
      await client.putACL(key, 'public-read');
      console.log(`[${i + 1}/${files.length}] ✓ ${key}`);
    } catch (err) {
      console.error(`[${i + 1}/${files.length}] ✗ ${key}: ${err.message}`);
    }
  }

  const domain = process.env.OSS_CUSTOM_DOMAIN
    ? `https://${process.env.OSS_CUSTOM_DOMAIN}`
    : `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com`;

  console.log(`\n✅ 部署完成！`);
  console.log(`📱 手机浏览器打开: ${domain}/index.html`);
}

deploy().catch((err) => {
  console.error('部署失败:', err.message);
  process.exit(1);
});
