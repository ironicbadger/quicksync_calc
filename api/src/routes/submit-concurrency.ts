/**
 * POST /api/submit-concurrency
 * Submit concurrency benchmark results from PR #10's benchmark script.
 */

import { Hono } from 'hono';
import { getDb, Env } from '../lib/db';
import { parseConcurrencyResults } from '../lib/parser';

const submitConcurrency = new Hono<{ Bindings: Env }>();

submitConcurrency.post('/', async (c) => {
  const contentType = c.req.header('Content-Type') || '';

  let body: string;
  let submitterId: string | null = null;
  let confirmed = false;

  if (contentType.includes('application/json')) {
    const json = await c.req.json<{ results?: string; submitter_id?: string; confirmed?: boolean }>();
    body = json.results || '';
    submitterId = json.submitter_id || null;
    confirmed = json.confirmed || false;
  } else {
    body = await c.req.text();
    submitterId = c.req.query('submitter_id') || null;
    confirmed = c.req.query('confirmed') === 'true';
  }

  if (!body.trim()) {
    return c.json({ success: false, error: 'Empty request body' }, 400);
  }

  const results = parseConcurrencyResults(body);

  if (results.length === 0) {
    return c.json({ success: false, error: 'No valid concurrency results found' }, 400);
  }

  const db = getDb(c.env);

  // Soft uniqueness check for submitter_id
  if (submitterId && !confirmed) {
    const existing = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM concurrency_results WHERE submitter_id = ?',
      args: [submitterId],
    });

    const existingCount = (existing.rows[0]?.count as number) || 0;

    if (existingCount > 0) {
      return c.json({
        success: false,
        requires_confirmation: true,
        existing_count: existingCount,
        message: `ID '${submitterId}' has ${existingCount} existing concurrency results. Set confirmed=true to proceed.`,
      }, 409);
    }
  }

  let inserted = 0;
  let skipped = 0;

  for (const result of results) {
    try {
      await db.execute({
        sql: `
          INSERT INTO concurrency_results (
            submitter_id, cpu_raw, cpu_brand, cpu_model, cpu_generation,
            architecture, test_name, test_file, speeds_json, max_concurrency,
            result_hash, vendor
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          submitterId,
          result.cpu_raw,
          result.cpu_brand,
          result.cpu_model,
          result.cpu_generation,
          result.architecture,
          result.test_name,
          result.test_file,
          result.speeds_json,
          result.max_concurrency,
          result.result_hash,
          result.vendor,
        ],
      });
      inserted++;
    } catch (e: unknown) {
      const error = e as Error;
      if (error.message?.includes('UNIQUE constraint')) {
        skipped++;
      } else {
        console.error('Insert error:', error);
        skipped++;
      }
    }
  }

  return c.json({
    success: true,
    inserted,
    skipped,
    total: results.length,
    message: `Successfully processed ${results.length} concurrency results`,
  });
});

export default submitConcurrency;
