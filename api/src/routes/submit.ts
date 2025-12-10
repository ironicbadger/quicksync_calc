/**
 * POST /api/submit
 * Direct submission of benchmark results (requires admin passphrase).
 * For normal submissions, use /api/submit/pending with web verification.
 */

import { Hono } from 'hono';
import { Env, readData, writeData, getNextId, hashExists, BenchmarkResult } from '../lib/r2';
import { withLock } from '../lib/lock';
import { parseResults } from '../lib/parser';
import { validateSubmitterId, normalizeSubmitterId } from '../lib/sanitize';

const submit = new Hono<{ Bindings: Env }>();

interface SubmitRequest {
  submitter_id?: string;
  confirmed?: boolean;
  passphrase?: string;
  results?: string;
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
    const json = await c.req.json<SubmitRequest>();
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

  // Validate submitter ID
  const validationError = validateSubmitterId(submitterId);
  if (validationError) {
    return c.json({ success: false, error: validationError }, 400);
  }

  // Normalize submitter ID (trim, collapse spaces)
  submitterId = normalizeSubmitterId(submitterId);

  // Parse results
  const results = parseResults(body);

  if (results.length === 0) {
    return c.json({ success: false, error: 'No valid results found' }, 400);
  }

  // Insert results into R2 JSON with locking
  let inserted = 0;
  let skipped = 0;

  try {
    await withLock(c.env.PENDING_SUBMISSIONS, async () => {
      // Read current data
      const data = await readData(c.env.DATA_BUCKET);

      // If submitter_id provided, check for existing submissions (soft uniqueness)
      if (submitterId && !confirmed) {
        const existingCount = data.results.filter(r => r.submitter_id === submitterId).length;

        if (existingCount > 0) {
          throw new SubmitterExistsError(submitterId, existingCount);
        }
      }

      // Get next ID
      let nextId = getNextId(data.results);

      // Add each result
      for (const result of results) {
        // Skip duplicates
        if (hashExists(data.results, result.result_hash)) {
          skipped++;
          continue;
        }

        // Validate power readings
        if (result.avg_watts !== null && result.avg_watts !== undefined) {
          if (result.avg_watts < 3.0) {
            return c.json({
              success: false,
              error: 'Invalid power reading',
              message: `Power reading of ${result.avg_watts}W is implausibly low (minimum: 3W). This usually indicates a measurement error. Please check intel_gpu_top output and file a GitHub issue if the problem persists.`,
              github_issue_url: 'https://github.com/ironicbadger/quicksync_calc/issues/new',
              measured_watts: result.avg_watts,
              expected_range: '10-50W'
            }, 400);
          }

          if (result.avg_watts > 200.0) {
            return c.json({
              success: false,
              error: 'Invalid power reading',
              message: `Power reading of ${result.avg_watts}W is implausibly high (maximum: 200W). Please verify your measurement.`,
              measured_watts: result.avg_watts,
              expected_range: '10-50W'
            }, 400);
          }
        }

        const newResult: BenchmarkResult = {
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
          bitrate_kbps: result.bitrate_kbps,
          time_seconds: result.time_seconds,
          avg_fps: result.avg_fps,
          avg_speed: result.avg_speed,
          avg_watts: result.avg_watts,
          fps_per_watt: result.fps_per_watt,
          result_hash: result.result_hash,
          vendor: result.vendor,
        };

        data.results.push(newResult);
        inserted++;
      }

      // Write back to R2 (with backup)
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
        message: `ID '${e.submitterId}' has ${e.existingCount} existing submissions. Set confirmed=true to proceed.`,
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
    message: `Successfully processed ${results.length} results`,
  });
});

// Custom error for submitter ID conflict
class SubmitterExistsError extends Error {
  constructor(public submitterId: string, public existingCount: number) {
    super(`Submitter ID ${submitterId} already exists`);
    this.name = 'SubmitterExistsError';
  }
}

export default submit;
