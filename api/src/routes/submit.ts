/**
 * POST /api/submit
 * Direct submission of benchmark results (requires admin passphrase).
 * For normal submissions, use /api/submit/pending with web verification.
 */

import { Hono } from 'hono';
import { getDb, Env } from '../lib/db';
import { parseResults } from '../lib/parser';

const submit = new Hono<{ Bindings: Env }>();

interface SubmitRequest {
  submitter_id?: string;
  confirmed?: boolean;
  passphrase?: string;
}

submit.post('/', async (c) => {
  // Check for admin passphrase (required for direct submission)
  const passphrase = c.req.query('passphrase');
  if (!passphrase || passphrase !== c.env.ADMIN_PASSPHRASE) {
    return c.json({
      success: false,
      error: 'Direct submission requires passphrase. Use web verification at https://quicksync.ktz.me/submit instead.',
    }, 403);
  }

  const contentType = c.req.header('Content-Type') || '';

  let body: string;
  let submitterId: string | null = null;
  let confirmed = false;

  // Handle both plain text and JSON submissions
  if (contentType.includes('application/json')) {
    const json = await c.req.json<SubmitRequest & { results: string }>();
    body = json.results || '';
    submitterId = json.submitter_id || null;
    confirmed = json.confirmed || false;
  } else {
    // Plain text - pipe-delimited results
    body = await c.req.text();
    // Check for submitter ID in query params
    submitterId = c.req.query('submitter_id') || null;
    confirmed = c.req.query('confirmed') === 'true';
  }

  if (!body.trim()) {
    return c.json({ success: false, error: 'Empty request body' }, 400);
  }

  // Parse results
  const results = parseResults(body);

  if (results.length === 0) {
    return c.json({ success: false, error: 'No valid results found' }, 400);
  }

  const db = getDb(c.env);

  // If submitter_id provided, check for existing submissions (soft uniqueness)
  if (submitterId && !confirmed) {
    const existing = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM benchmark_results WHERE submitter_id = ?',
      args: [submitterId],
    });

    const existingCount = (existing.rows[0]?.count as number) || 0;

    if (existingCount > 0) {
      return c.json({
        success: false,
        requires_confirmation: true,
        existing_count: existingCount,
        message: `ID '${submitterId}' has ${existingCount} existing submissions. Set confirmed=true to proceed.`,
      }, 409);
    }
  }

  // Insert results
  let inserted = 0;
  let skipped = 0;

  for (const result of results) {
    try {
      await db.execute({
        sql: `
          INSERT INTO benchmark_results (
            submitter_id, cpu_raw, cpu_brand, cpu_model, cpu_generation,
            architecture, test_name, test_file, bitrate_kbps, time_seconds,
            avg_fps, avg_speed, avg_watts, fps_per_watt, result_hash, vendor
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          result.bitrate_kbps,
          result.time_seconds,
          result.avg_fps,
          result.avg_speed,
          result.avg_watts,
          result.fps_per_watt,
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
    message: `Successfully processed ${results.length} results`,
  });
});

export default submit;
