/**
 * QuickSync Benchmark API
 * Cloudflare Worker for submitting and querying benchmark results.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './lib/db';

import submit from './routes/submit';
import submitPending from './routes/submit-pending';
import submitConcurrency from './routes/submit-concurrency';
import results from './routes/results';
import stats from './routes/stats';
import scores from './routes/scores';

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
    version: '1.0.0',
    endpoints: {
      'POST /api/submit': 'Submit benchmark results (requires passphrase)',
      'POST /api/submit/pending': 'Upload results for web verification',
      'GET /api/submit/pending/:token': 'Get pending results for preview',
      'POST /api/submit/pending/confirm': 'Confirm submission with Turnstile',
      'POST /api/submit-concurrency': 'Submit concurrency benchmark results',
      'GET /api/results': 'Query benchmark results',
      'GET /api/results/filters': 'Get available filter values',
      'GET /api/stats': 'Get aggregated statistics',
      'GET /api/stats/boxplot': 'Get boxplot data for charts',
      'GET /api/stats/summary': 'Get summary statistics',
      'GET /api/scores': 'Get CPU scores with methodology',
      'GET /api/scores/for-results': 'Get score lookup map for all CPUs',
      'GET /api/results/generation-detail': 'Get comprehensive data for a generation page',
      'GET /api/results/architectures': 'Get all CPU architectures with metadata',
      'GET /api/results/arc-models': 'Get Arc GPU models with individual stats',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.route('/api/submit/pending', submitPending);
app.route('/api/submit', submit);
app.route('/api/submit-concurrency', submitConcurrency);
app.route('/api/results', results);
app.route('/api/stats', stats);
app.route('/api/scores', scores);

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
