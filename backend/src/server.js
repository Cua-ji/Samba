import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { checkDbHealth } from './db/pool.js';
import { ensureDatabaseReady } from './db/seed.js';
import { getDatabaseStats } from './db/repository.js';
import { checkOllamaHealth } from './services/ollama.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import mealsRoutes from './routes/meals.routes.js';
import workoutsRoutes from './routes/workouts.routes.js';
import ragRoutes from './routes/rag.routes.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      const [dbInfo, stats, ollamaInfo] = await Promise.all([
        checkDbHealth(),
        getDatabaseStats(),
        checkOllamaHealth(),
      ]);
      res.json({
        status: 'ok',
        service: 'Samba Neuro-Symbolic & RAG API',
        brand: 'Whixte & Co.',
        database: {
          connected: true,
          engine: 'PostgreSQL 16 (Docker)',
          name: dbInfo.database,
          stats,
        },
        ollama: ollamaInfo,
        llmProvider: process.env.LLM_PROVIDER || 'auto',
        llmConfigured: Boolean(
          ollamaInfo.connected ||
            (process.env.GEMINI_API_KEY || '').trim() ||
            (process.env.OPENAI_API_KEY || '').trim()
        ),
      });
    } catch (err) {
      res.status(503).json({
        status: 'degraded',
        service: 'Samba Neuro-Symbolic & RAG API',
        database: {
          connected: false,
          error: err.message,
        },
      });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/meals', mealsRoutes);
  app.use('/api/workouts', workoutsRoutes);
  app.use('/api/chat', ragRoutes);

  const frontendDistDir = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDistDir)) {
    app.use(express.static(frontendDistDir));
    app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(frontendDistDir, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    console.error('[Samba Backend Error]', err);
    res.status(500).json({ error: 'Error interno en el servidor Samba.' });
  });

  return app;
}

function getLocalNetworkUrls(port) {
  const urls = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return urls;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const port = Number(process.env.PORT || 3001);
  ensureDatabaseReady()
    .then(() => {
      const app = createApp();
      app.listen(port, '0.0.0.0', () => {
        console.log(`Samba Neuro-Symbolic API + PostgreSQL listening on http://localhost:${port}`);
        const lanUrls = getLocalNetworkUrls(port);
        for (const url of lanUrls) {
          console.log(`  -> Acceso desde celular (LAN): ${url}`);
        }
      });
    })
    .catch((err) => {
      console.error('Failed to connect/seed PostgreSQL:', err);
      process.exit(1);
    });
}
