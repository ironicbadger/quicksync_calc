/**
 * QuickSync Benchmark API
 * Cloudflare Worker for submitting benchmark results.
 *
 * Data is stored in R2 as a single JSON file.
 * Frontend loads data directly from R2 and does client-side filtering.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './lib/r2';

import submit from './routes/submit';
import submitPending from './routes/submit-pending';
import submitConcurrency from './routes/submit-concurrency';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Allow production, localhost, and Pages preview URLs
    const allowed = [
      'https://quicksync.ktz.me',
      'http://localhost:4321',
      'http://localhost:3000',
    ];
    if (allowed.includes(origin)) return origin;
    // Allow Cloudflare Pages preview URLs
    if (origin?.endsWith('.quicksync-web.pages.dev')) return origin;
    return 'https://quicksync.ktz.me';
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400,
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'QuickSync Benchmark API',
    version: '2.0.0',
    storage: 'R2 JSON',
    endpoints: {
      'POST /api/submit': 'Submit benchmark results (requires passphrase)',
      'POST /api/submit/pending': 'Upload results for web verification',
      'GET /api/submit/pending/:token': 'Get pending results for preview',
      'POST /api/submit/pending/confirm': 'Confirm submission with Turnstile',
      'POST /api/submit-concurrency': 'Submit concurrency benchmark results',
    },
    data: 'Frontend loads data from R2: https://data.quicksync.ktz.me/benchmarks.json',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes (only submission routes - data is served from R2)
app.route('/api/submit/pending', submitPending);
app.route('/api/submit', submit);
app.route('/api/submit-concurrency', submitConcurrency);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
