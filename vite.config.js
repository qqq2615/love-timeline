import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 本地开发时内联 API 路由
function apiMiddleware() {
  return {
    name: 'api-middleware',
    configureServer(server) {
      // 使用 Vite 的方式加载环境变量
      const env = loadEnv('development', process.cwd(), '');

      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/oss-token')) {
          return next();
        }

        // 只处理 POST
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // 读取请求体
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const { fileName, contentType, prefix = 'photos' } = JSON.parse(body);

            if (!fileName || !contentType) {
              res.writeHead(400).end(JSON.stringify({ error: 'Missing fileName or contentType' }));
              return;
            }

            // 动态导入 ali-oss（避免构建时加载）
            const OSS = (await import('ali-oss')).default;

            const region = env.OSS_REGION || 'oss-cn-hangzhou';
            const bucket = env.OSS_BUCKET;
            const accessKeyId = env.OSS_ACCESS_KEY_ID;
            const accessKeySecret = env.OSS_ACCESS_KEY_SECRET;
            const customDomain = env.OSS_CUSTOM_DOMAIN || '';

            if (!bucket || !accessKeyId || !accessKeySecret) {
              res.writeHead(500).end(JSON.stringify({
                error: 'OSS 未配置。请复制 .env.example 为 .env 并填入你的阿里云 OSS 凭证。'
              }));
              return;
            }

            const client = new OSS({ region, accessKeyId, accessKeySecret, bucket });

            const ext = fileName.split('.').pop().toLowerCase();
            const uuid = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
            const key = `${prefix}/${uuid}.${ext}`;

            const uploadUrl = client.signatureUrl(key, {
              method: 'PUT',
              'Content-Type': contentType,
              expires: 300,
            });

            const publicUrl = customDomain
              ? `https://${customDomain}/${key}`
              : `https://${bucket}.${region}.aliyuncs.com/${key}`;

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify({ uploadUrl, publicUrl, key }));
          } catch (err) {
            console.error('OSS 签名失败:', err);
            res.writeHead(500).end(JSON.stringify({ error: '签名生成失败: ' + err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    apiMiddleware(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
