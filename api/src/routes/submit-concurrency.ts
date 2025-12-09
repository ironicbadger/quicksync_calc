/**
 * POST /api/submit-concurrency
 * Submit concurrency benchmark results from PR #10's benchmark script.
 */

import { Hono } from 'hono';
import { Env, readData, writeData, ConcurrencyResult } from '../lib/r2';
import { withLock } from '../lib/lock';
import { parseConcurrencyResults } from '../lib/parser';
import { validateSubmitterId, normalizeSubmitterId } from '../lib/sanitize';

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

  // Validate submitter ID
  const validationError = validateSubmitterId(submitterId);
  if (validationError) {
    return c.json({ success: false, error: validationError }, 400);
  }

  // Normalize submitter ID (trim, collapse spaces)
  submitterId = normalizeSubmitterId(submitterId);

  const results = parseConcurrencyResults(body);

  if (results.length === 0) {
    return c.json({ success: false, error: 'No valid concurrency results found' }, 400);
  }

  let inserted = 0;
  let skipped = 0;

  try {
    await withLock(c.env.PENDING_SUBMISSIONS, async () => {
      const data = await readData(c.env.DATA_BUCKET);

      // Soft uniqueness check for submitter_id
      if (submitterId && !confirmed) {
        const existingCount = data.concurrencyResults.filter(r => r.submitter_id === submitterId).length;

        if (existingCount > 0) {
          throw new SubmitterExistsError(submitterId, existingCount);
        }
      }

      // Get next ID
      let nextId = data.concurrencyResults.length > 0
        ? Math.max(...data.concurrencyResults.map(r => r.id)) + 1
        : 1;

      // Create hash set for deduplication
      const existingHashes = new Set(data.concurrencyResults.map(r => r.result_hash));

      for (const result of results) {
        // Skip duplicates
        if (existingHashes.has(result.result_hash)) {
          skipped++;
          continue;
        }

        const newResult: ConcurrencyResult = {
          id: nextId++,
          submitted_at: new Date().toISOString(),
          submitter_id: submitterId,
          cpu_raw: result.cpu_raw,
          cpu_brand: result.cpu_brand,
          cpu_model: result.cpu_model,
          cpu_generation: result.cpu_generation,
          architecture: result.architecture,
          test_name: result.test_name,
          test_file: result.test_file,
          speeds_json: JSON.parse(result.speeds_json),
          max_concurrency: result.max_concurrency,
          result_hash: result.result_hash,
          vendor: result.vendor,
        };

        data.concurrencyResults.push(newResult);
        inserted++;
      }

      if (inserted > 0) {
        await writeData(c.env.DATA_BUCKET, data);
      }
    });
  } catch (e) {
    if (e instanceof SubmitterExistsError) {
      return c.json({
        success: false,
        requires_confirmation: true,
        existing_count: e.existingCount,
        message: `ID '${e.submitterId}' has ${e.existingCount} existing concurrency results. Set confirmed=true to proceed.`,
      }, 409);
    }

    const error = e as Error;
    console.error('R2 write error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to save results. Please try again.',
    }, 500);
  }

  return c.json({
    success: true,
    inserted,
    skipped,
    total: results.length,
    message: `Successfully processed ${results.length} concurrency results`,
  });
});

// Custom error for submitter ID conflict
class SubmitterExistsError extends Error {
  constructor(public submitterId: string, public existingCount: number) {
    super(`Submitter ID ${submitterId} already exists`);
    this.name = 'SubmitterExistsError';
  }
}

export default submitConcurrency;
