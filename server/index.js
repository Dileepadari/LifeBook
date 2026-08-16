import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seed } from './seed.js';
import { authRoutes } from './routes/auth.js';
import { dataRoutes } from './routes/data.js';
import { studyRoutes } from './routes/study.js';
import { dayRoutes } from './routes/day.js';
import { lifebookRoutes } from './routes/lifebook.js';
import { insightRoutes } from './routes/insights.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// Load .env without a dependency - Node's built-in --env-file needs the flag
// at launch, and this keeps `npm start` working for anyone who just clones.
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

seed();

const app = express();
app.use(express.json({ limit: '2mb' }));

// Uploaded files. Paths are /uploads/<user-id>/<generated-name>, and the
// generated name is unguessable - but this is still a static mount, so treat a
// leaked URL as public. Anything genuinely sensitive should not be uploaded.
app.use('/uploads', express.static(path.join(root, 'uploads'), { index: false, dotfiles: 'deny' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'lifebook' }));

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/day', dayRoutes);
app.use('/api/lifebook', lifebookRoutes);
app.use('/api', insightRoutes);

// In production the SPA build is served by the same process, so a deployment
// is one `npm run build && npm start` with no separate web server.
const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Single error handler. Routes throw with an optional `status`; anything
// without one is a genuine bug and gets logged with its stack.
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[lifebook]', err);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`LifeBook API listening on http://localhost:${PORT}`);
});
