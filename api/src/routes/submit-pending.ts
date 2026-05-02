/**
 * Pending submission endpoints for human verification flow.
 *
 * POST /api/submit/pending - Store results in KV, return token
 * GET /api/submit/pending/:token - Retrieve pending results for preview
 * POST /api/submit/pending/confirm - Validate Turnstile, commit to R2
 */

import { Hono } from 'hono';
import { Env, readData, writeData, getNextId, hashExists, BenchmarkResult, ConcurrencyResult } from '../lib/r2';
import { withLock } from '../lib/lock';
import { parseResults, parseConcurrencyResults, ParsedResult, ParsedConcurrencyResult } from '../lib/parser';
import { isBlockedCPU } from '../lib/cpu-parser';
import { validateSubmitterId, normalizeSubmitterId } from '../lib/sanitize';

const submitPending = new Hono<{ Bindings: Env }>();

interface PendingSubmission {
  results: ParsedResult[];
  concurrencyResults?: ParsedConcurrencyResult[];
  created_at: string;
}

interface ConfirmRequest {
  token: string;
  turnstile_token: string;
  submitter_id?: string;
}

const KV_PREFIX = 'pending:';
const TTL_SECONDS = 86400; // 24 hours

/**
 * POST /api/submit/pending
 * Parse results and store in KV with a token. Returns token for web verification.
 */
submitPending.post('/', async (c) => {
  const body = await c.req.text();

  if (!body.trim()) {
    return c.json({ success: false, error: 'Empty request body' }, 400);
  }

  // Parse results using existing parser
  const results = await parseResults(body);

  if (results.length === 0) {
    return c.json({ success: false, error: 'No valid results found' }, 400);
  }

  // Validate CPU - check for blocked CPUs (virtual machines, etc.)
  const blockedCPUs = results.filter(r => isBlockedCPU(r.cpu_raw));
  if (blockedCPUs.length > 0) {
    return c.json({
      success: false,
      error: 'Virtual/emulated CPUs are not supported for benchmarking',
      blocked_cpu: blockedCPUs[0].cpu_raw,
    }, 400);
  }

  // Validate CPU - require architecture to be detected
  const unknownCPUs = results.filter(r => r.architecture === null);
  if (unknownCPUs.length > 0) {
    return c.json({
      success: false,
      error: 'Unrecognized CPU architecture. Please report this CPU model.',
      unknown_cpu: unknownCPUs[0].cpu_raw,
    }, 400);
  }

  // Generate unique token
  const token = crypto.randomUUID();

  // Store in KV with TTL
  const submission: PendingSubmission = {
    results,
    created_at: new Date().toISOString(),
  };

  await c.env.PENDING_SUBMISSIONS.put(
    `${KV_PREFIX}${token}`,
    JSON.stringify(submission),
    { expirationTtl: TTL_SECONDS }
  );

  return c.json({
    success: true,
    token,
    results_count: results.length,
    expires_in_hours: 24,
    message: 'Results uploaded. Complete verification at quicksync.ktz.me/submit',
  });
});

/**
 * POST /api/submit/pending/:token/concurrency
 * Add concurrency results to an existing pending submission.
 */
submitPending.post('/:token/concurrency', async (c) => {
  const token = c.req.param('token');
  const body = await c.req.text();

  if (!token) {
    return c.json({ success: false, error: 'Token required' }, 400);
  }

  if (!body.trim()) {
    return c.json({ success: false, error: 'Empty request body' }, 400);
  }

  // Fetch existing pending submission
  const existingData = await c.env.PENDING_SUBMISSIONS.get(`${KV_PREFIX}${token}`);

  if (!existingData) {
    return c.json({
      success: false,
      error: 'Submission not found or expired',
      expired: true,
    }, 404);
  }

  const submission: PendingSubmission = JSON.parse(existingData);

  // Parse concurrency results
  const concurrencyResults = await parseConcurrencyResults(body);

  if (concurrencyResults.length === 0) {
    return c.json({ success: false, error: 'No valid concurrency results found' }, 400);
  }

  // Add concurrency results to submission
  submission.concurrencyResults = concurrencyResults;

  // Update in KV
  await c.env.PENDING_SUBMISSIONS.put(
    `${KV_PREFIX}${token}`,
    JSON.stringify(submission),
    { expirationTtl: TTL_SECONDS }
  );

  return c.json({
    success: true,
    concurrency_results_count: concurrencyResults.length,
    message: 'Concurrency results added to submission',
  });
});

/**
 * GET /api/submit/pending/:token
 * Retrieve pending submission for preview on web page.
 */
submitPending.get('/:token', async (c) => {
  const token = c.req.param('token');

  if (!token) {
    return c.json({ success: false, error: 'Token required' }, 400);
  }

  const data = await c.env.PENDING_SUBMISSIONS.get(`${KV_PREFIX}${token}`);

  if (!data) {
    return c.json({
      success: false,
      error: 'Submission not found or expired',
      expired: true,
    }, 404);
  }

  const submission: PendingSubmission = JSON.parse(data);

  return c.json({
    success: true,
    results: submission.results,
    concurrencyResults: submission.concurrencyResults || [],
    created_at: submission.created_at,
    results_count: submission.results.length,
    concurrency_results_count: submission.concurrencyResults?.length || 0,
  });
});

/**
 * POST /api/submit/pending/confirm
 * Validate Turnstile CAPTCHA and commit results to R2 JSON file.
 */
submitPending.post('/confirm', async (c) => {
  const contentType = c.req.header('Content-Type') || '';

  let request: ConfirmRequest;

  if (contentType.includes('application/json')) {
    request = await c.req.json<ConfirmRequest>();
  } else {
    return c.json({ success: false, error: 'Content-Type must be application/json' }, 400);
  }

  const { token, turnstile_token, submitter_id } = request;

  if (!token) {
    return c.json({ success: false, error: 'Token required' }, 400);
  }

  if (!turnstile_token) {
    return c.json({ success: false, error: 'Turnstile verification required' }, 400);
  }

  // Validate submitter ID
  const validationError = validateSubmitterId(submitter_id);
  if (validationError) {
    return c.json({ success: false, error: validationError }, 400);
  }

  // Validate Turnstile token
  const turnstileResponse = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: c.env.TURNSTILE_SECRET,
        response: turnstile_token,
      }),
    }
  );

  const turnstileResult = await turnstileResponse.json<{ success: boolean; 'error-codes'?: string[] }>();

  if (!turnstileResult.success) {
    return c.json({
      success: false,
      error: 'Verification failed. Please try again.',
      turnstile_errors: turnstileResult['error-codes'],
    }, 400);
  }

  // Fetch pending submission from KV
  const kvData = await c.env.PENDING_SUBMISSIONS.get(`${KV_PREFIX}${token}`);

  if (!kvData) {
    return c.json({
      success: false,
      error: 'Submission not found or expired. Please run the benchmark again.',
      expired: true,
    }, 404);
  }

  const submission: PendingSubmission = JSON.parse(kvData);
  const results = submission.results;
  const concurrencyResults = submission.concurrencyResults || [];

  // Normalize submitter_id (already validated above)
  const sanitizedSubmitterId = normalizeSubmitterId(submitter_id);

  // Insert results into R2 JSON with locking
  let inserted = 0;
  let skipped = 0;
  let concurrencyInserted = 0;
  let concurrencySkipped = 0;

  try {
    await withLock(c.env.PENDING_SUBMISSIONS, async () => {
      // Read current data
      const data = await readData(c.env.DATA_BUCKET);

      // Get next ID for standard results
      let nextId = getNextId(data.results);

      // Add each standard result
      for (const result of results) {
        // Skip duplicates
        if (hashExists(data.results, result.result_hash)) {
          skipped++;
          continue;
        }

        const newResult: BenchmarkResult = {
          id: nextId++,
          submitted_at: new Date().toISOString(),
          submitter_id: sanitizedSubmitterId,
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

      // Add concurrency results if present
      if (concurrencyResults.length > 0) {
        let concurrencyNextId = data.concurrencyResults.length > 0
          ? Math.max(...data.concurrencyResults.map(r => r.id)) + 1
          : 1;

        for (const result of concurrencyResults) {
          // Check for duplicate concurrency results
          const isDuplicate = data.concurrencyResults.some(
            r => r.result_hash === result.result_hash
          );

          if (isDuplicate) {
            concurrencySkipped++;
            continue;
          }

          const newConcurrencyResult: ConcurrencyResult = {
            id: concurrencyNextId++,
            submitted_at: new Date().toISOString(),
            submitter_id: sanitizedSubmitterId,
            cpu_raw: result.cpu_raw,
            cpu_brand: result.cpu_brand,
            cpu_model: result.cpu_model,
            cpu_generation: result.cpu_generation,
            architecture: result.architecture,
            test_name: result.test_name,
            test_file: result.test_file,
            speeds_json: result.speeds_json,
            max_concurrency: result.max_concurrency,
            result_hash: result.result_hash,
            vendor: result.vendor,
          };

          data.concurrencyResults.push(newConcurrencyResult);
          concurrencyInserted++;
        }
      }

      // Write back to R2 (with backup)
      if (inserted > 0 || concurrencyInserted > 0) {
        await writeData(c.env.DATA_BUCKET, data);
      }
    });
  } catch (e) {
    const error = e as Error;
    console.error('R2 write error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to save results. Please try again.',
    }, 500);
  }

  // Delete from KV after successful insertion
  await c.env.PENDING_SUBMISSIONS.delete(`${KV_PREFIX}${token}`);

  const totalInserted = inserted + concurrencyInserted;
  let message = '';
  if (totalInserted > 0) {
    const parts = [];
    if (inserted > 0) parts.push(`${inserted} benchmark result${inserted !== 1 ? 's' : ''}`);
    if (concurrencyInserted > 0) parts.push(`${concurrencyInserted} concurrency result${concurrencyInserted !== 1 ? 's' : ''}`);
    message = `Successfully submitted ${parts.join(' and ')}!`;
  } else {
    message = 'All results were already in the database.';
  }

  return c.json({
    success: true,
    inserted,
    skipped,
    concurrency_inserted: concurrencyInserted,
    concurrency_skipped: concurrencySkipped,
    total: results.length + concurrencyResults.length,
    message,
  });
});

export default submitPending;
