# love-timeline

A React + Vite timeline app with self-hosted user login, cloud-synced encrypted backups, and Aliyun OSS media support.

## Features

- User registration and login via backend JWT auth
- Aliyun OSS signed uploads for user-specific media
- Encrypted cloud backup storage per user
- Cross-device sync using OSS and server-side sync metadata
- Local IndexedDB storage fallback for offline use
- PWA-ready frontend with service worker support

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment example and configure your OSS credentials and backend secret:

```bash
cp .env.example .env
```

3. Edit `.env` and set:

- `OSS_REGION`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `JWT_SECRET`
- optional: `OSS_CUSTOM_DOMAIN`, `BCRYPT_ROUNDS`

## Development

The app uses a Node backend at `server.js` for auth, signing, and cloud sync.

Start the backend server:

```bash
npm run dev:server
```

Then start the frontend:

```bash
npm run dev
```

The Vite dev server proxies `/api` requests to the backend.

## Production

Build the frontend and run the server:

```bash
npm run build
npm start
```

The server serves the static `dist` files in production.

## Deploying the backend (Render / Heroku / VPS / Docker)

This project includes a simple `server.js` that must be deployed to a public host for login, OSS signing and sync features to work. Two quick options:

- Heroku (quick):
	1. Create a new app on Heroku.
	2. Add environment variables in the Heroku Dashboard: `OSS_REGION`, `OSS_BUCKET`, `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, `JWT_SECRET`.
	3. Push this repository to Heroku or connect GitHub and enable automatic deploys. Heroku will use the `Procfile`.

- Render (recommended for simplicity):
	1. Create a new Web Service on Render and connect your GitHub repo.
	2. Set the build command to `npm ci && npm run build` and start command to `npm start`.
	3. Add the same environment variables in the Render service settings.

Alternatively you can build a Docker image and deploy it to any container host using the included `Dockerfile`.

After the backend is live at `https://api.yourdomain.com`, rebuild and redeploy the frontend with `VITE_API_BASE` set:

```bash
VITE_API_BASE=https://api.yourdomain.com npm run build
npm run deploy
```

This will update the GitHub Pages site to point to your running backend so login, cloud backup and sync work correctly.

## Notes

- The backend stores user credentials in `users.json` with bcrypt hashing.
- Cloud backups and sync files are stored under user-specific OSS prefixes.
- Encryption keys for uploaded backups are derived from the user-provided password and username.

## Environment variables

See `.env.example` for the required OSS and authentication settings.
