/**
 * GET /api/results
 * Query benchmark results with filtering.
 */

import { Hono } from 'hono';
import { getDb, Env, BenchmarkResult } from '../lib/db';

const results = new Hono<{ Bindings: Env }>();

results.get('/', async (c) => {
  const db = getDb(c.env);

  // Query parameters for filtering
  const generation = c.req.query('generation');      // e.g., "12,13,14"
  const architecture = c.req.query('architecture');  // e.g., "Alder Lake,Raptor Lake"
  const testName = c.req.query('test');              // e.g., "h264_1080p,hevc_8bit"
  const cpuRaw = c.req.query('cpu');                 // e.g., "i5-8500||i7-12700" (|| delimiter)
  const submitterId = c.req.query('submitter_id');
  const minFps = c.req.query('min_fps');
  const maxFps = c.req.query('max_fps');
  const minWatts = c.req.query('min_watts');
  const maxWatts = c.req.query('max_watts');
  const minEfficiency = c.req.query('min_efficiency');
  const maxEfficiency = c.req.query('max_efficiency');
  const vendor = c.req.query('vendor') || 'intel';
  const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 1000);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const sortBy = c.req.query('sort') || 'submitted_at';
  const sortOrder = c.req.query('order') === 'asc' ? 'ASC' : 'DESC';

  // Build query
  const conditions: string[] = ['vendor = ?'];
  const args: (string | number)[] = [vendor];

  if (generation) {
    const gens = generation.split(',').map(g => parseInt(g.trim(), 10)).filter(g => !isNaN(g));
    if (gens.length > 0) {
      conditions.push(`cpu_generation IN (${gens.map(() => '?').join(',')})`);
      args.push(...gens);
    }
  }

  if (architecture) {
    const archs = architecture.split(',').map(a => a.trim()).filter(a => a);
    if (archs.length > 0) {
      conditions.push(`architecture IN (${archs.map(() => '?').join(',')})`);
      args.push(...archs);
    }
  }

  if (testName) {
    const tests = testName.split(',').map(t => t.trim()).filter(t => t);
    if (tests.length > 0) {
      conditions.push(`test_name IN (${tests.map(() => '?').join(',')})`);
      args.push(...tests);
    }
  }

  if (cpuRaw) {
    // Use || as delimiter since CPU names can contain commas
    const cpus = cpuRaw.split('||').map(c => c.trim()).filter(c => c);
    if (cpus.length > 0) {
      conditions.push(`cpu_raw IN (${cpus.map(() => '?').join(',')})`);
      args.push(...cpus);
    }
  }

  if (submitterId) {
    conditions.push('submitter_id = ?');
    args.push(submitterId);
  }

  if (minFps) {
    conditions.push('avg_fps >= ?');
    args.push(parseFloat(minFps));
  }

  if (maxFps) {
    conditions.push('avg_fps <= ?');
    args.push(parseFloat(maxFps));
  }

  if (minWatts) {
    conditions.push('avg_watts >= ?');
    args.push(parseFloat(minWatts));
  }

  if (maxWatts) {
    conditions.push('avg_watts <= ?');
    args.push(parseFloat(maxWatts));
  }

  if (minEfficiency) {
    conditions.push('fps_per_watt >= ?');
    args.push(parseFloat(minEfficiency));
  }

  if (maxEfficiency) {
    conditions.push('fps_per_watt <= ?');
    args.push(parseFloat(maxEfficiency));
  }

  // Validate sort column
  const allowedSortColumns = [
    'id', 'submitted_at', 'cpu_generation', 'architecture', 'test_name',
    'avg_fps', 'avg_watts', 'fps_per_watt', 'avg_speed', 'bitrate_kbps', 'time_seconds', 'cpu_raw'
  ];
  const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'submitted_at';

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as total FROM benchmark_results WHERE ${whereClause}`,
    args,
  });
  const total = (countResult.rows[0]?.total as number) || 0;

  // Get results
  const queryResult = await db.execute({
    sql: `
      SELECT * FROM benchmark_results
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `,
    args: [...args, limit, offset],
  });

  const rows = queryResult.rows as unknown as BenchmarkResult[];

  return c.json({
    success: true,
    total,
    limit,
    offset,
    count: rows.length,
    results: rows,
  });
});

// Get distinct values for filter dropdowns
results.get('/filters', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';

  const [generations, architectures, tests] = await Promise.all([
    db.execute({
      sql: `SELECT DISTINCT cpu_generation FROM benchmark_results WHERE vendor = ? AND cpu_generation IS NOT NULL ORDER BY cpu_generation`,
      args: [vendor],
    }),
    db.execute({
      sql: `SELECT DISTINCT architecture FROM benchmark_results WHERE vendor = ? AND architecture IS NOT NULL ORDER BY architecture`,
      args: [vendor],
    }),
    db.execute({
      sql: `SELECT DISTINCT test_name FROM benchmark_results WHERE vendor = ? ORDER BY test_name`,
      args: [vendor],
    }),
  ]);

  return c.json({
    success: true,
    filters: {
      generations: generations.rows.map(r => r.cpu_generation),
      architectures: architectures.rows.map(r => r.architecture),
      tests: tests.rows.map(r => r.test_name),
    },
  });
});

// Get filter counts based on current selection (for dynamic filter updates)
results.get('/filter-counts', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';
  const generation = c.req.query('generation');
  const architecture = c.req.query('architecture');
  const testName = c.req.query('test');

  // Build base conditions
  const baseConditions: string[] = ['vendor = ?'];
  const baseArgs: (string | number)[] = [vendor];

  // Parse current filters
  const selectedGens = generation ? generation.split(',').map(g => parseInt(g.trim(), 10)).filter(g => !isNaN(g)) : [];
  const selectedArchs = architecture ? architecture.split(',').map(a => a.trim()).filter(a => a) : [];
  const selectedTests = testName ? testName.split(',').map(t => t.trim()).filter(t => t) : [];

  // Count generations (filtered by architecture and test)
  const genConditions = [...baseConditions];
  const genArgs = [...baseArgs];
  if (selectedArchs.length > 0) {
    genConditions.push(`architecture IN (${selectedArchs.map(() => '?').join(',')})`);
    genArgs.push(...selectedArchs);
  }
  if (selectedTests.length > 0) {
    genConditions.push(`test_name IN (${selectedTests.map(() => '?').join(',')})`);
    genArgs.push(...selectedTests);
  }

  // Count architectures (filtered by generation and test)
  const archConditions = [...baseConditions];
  const archArgs = [...baseArgs];
  if (selectedGens.length > 0) {
    archConditions.push(`cpu_generation IN (${selectedGens.map(() => '?').join(',')})`);
    archArgs.push(...selectedGens);
  }
  if (selectedTests.length > 0) {
    archConditions.push(`test_name IN (${selectedTests.map(() => '?').join(',')})`);
    archArgs.push(...selectedTests);
  }

  // Count tests (filtered by generation and architecture)
  const testConditions = [...baseConditions];
  const testArgs = [...baseArgs];
  if (selectedGens.length > 0) {
    testConditions.push(`cpu_generation IN (${selectedGens.map(() => '?').join(',')})`);
    testArgs.push(...selectedGens);
  }
  if (selectedArchs.length > 0) {
    testConditions.push(`architecture IN (${selectedArchs.map(() => '?').join(',')})`);
    testArgs.push(...selectedArchs);
  }

  // Count CPUs (filtered by generation, architecture, and test)
  const cpuConditions = [...baseConditions];
  const cpuArgs = [...baseArgs];
  if (selectedGens.length > 0) {
    cpuConditions.push(`cpu_generation IN (${selectedGens.map(() => '?').join(',')})`);
    cpuArgs.push(...selectedGens);
  }
  if (selectedArchs.length > 0) {
    cpuConditions.push(`architecture IN (${selectedArchs.map(() => '?').join(',')})`);
    cpuArgs.push(...selectedArchs);
  }
  if (selectedTests.length > 0) {
    cpuConditions.push(`test_name IN (${selectedTests.map(() => '?').join(',')})`);
    cpuArgs.push(...selectedTests);
  }

  const [genCounts, archCounts, testCounts, cpuCounts, submitterCounts] = await Promise.all([
    db.execute({
      sql: `SELECT cpu_generation as value, COUNT(*) as count FROM benchmark_results WHERE ${genConditions.join(' AND ')} AND cpu_generation IS NOT NULL GROUP BY cpu_generation`,
      args: genArgs,
    }),
    db.execute({
      sql: `SELECT architecture as value, COUNT(*) as count FROM benchmark_results WHERE ${archConditions.join(' AND ')} AND architecture IS NOT NULL GROUP BY architecture`,
      args: archArgs,
    }),
    db.execute({
      sql: `SELECT test_name as value, COUNT(*) as count FROM benchmark_results WHERE ${testConditions.join(' AND ')} GROUP BY test_name`,
      args: testArgs,
    }),
    db.execute({
      sql: `SELECT cpu_raw as value, COUNT(*) as count FROM benchmark_results WHERE ${cpuConditions.join(' AND ')} GROUP BY cpu_raw ORDER BY count DESC LIMIT 100`,
      args: cpuArgs,
    }),
    db.execute({
      sql: `SELECT submitter_id as value, COUNT(*) as count FROM benchmark_results WHERE ${baseConditions.join(' AND ')} AND submitter_id IS NOT NULL AND submitter_id != '' GROUP BY submitter_id ORDER BY count DESC LIMIT 50`,
      args: baseArgs,
    }),
  ]);

  return c.json({
    success: true,
    counts: {
      generations: Object.fromEntries(genCounts.rows.map(r => [r.value, r.count])),
      architectures: Object.fromEntries(archCounts.rows.map(r => [r.value, r.count])),
      tests: Object.fromEntries(testCounts.rows.map(r => [r.value, r.count])),
      cpus: Object.fromEntries(cpuCounts.rows.map(r => [r.value, r.count])),
      submitters: Object.fromEntries(submitterCounts.rows.map(r => [r.value, r.count])),
    },
  });
});

// Get aggregated statistics for multiple generations (with 8th gen baseline)
results.get('/generation-stats', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';
  const generationParam = c.req.query('generation'); // Can be "12" or "12,13,14"
  const baselineGen = 8; // Always compare against 8th Gen as baseline

  if (!generationParam) {
    return c.json({ success: false, error: 'generation parameter required' }, 400);
  }

  // Parse multiple generations
  const generations = generationParam.split(',').map(g => parseInt(g.trim(), 10)).filter(g => !isNaN(g));
  if (generations.length === 0) {
    return c.json({ success: false, error: 'Invalid generation numbers' }, 400);
  }

  // Ensure baseline is always included if not already selected
  const allGensToFetch = [...new Set([...generations, baselineGen])];

  // Fetch stats for all requested generations in one query
  const genPlaceholders = allGensToFetch.map(() => '?').join(',');

  const [statsResult, overallResult, baselineOverallResult] = await Promise.all([
    // Stats per generation per test type
    db.execute({
      sql: `
        SELECT
          cpu_generation,
          test_name,
          COUNT(*) as result_count,
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(MIN(avg_fps), 1) as min_fps,
          ROUND(MAX(avg_fps), 1) as max_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as avg_fps_per_watt,
          ROUND(AVG(avg_speed), 2) as avg_speed
        FROM benchmark_results
        WHERE vendor = ? AND cpu_generation IN (${genPlaceholders})
        GROUP BY cpu_generation, test_name
        ORDER BY cpu_generation, test_name
      `,
      args: [vendor, ...allGensToFetch],
    }),
    // Overall stats per generation
    db.execute({
      sql: `
        SELECT
          cpu_generation,
          COUNT(*) as total_results,
          COUNT(DISTINCT cpu_raw) as unique_cpus,
          ROUND(AVG(avg_fps), 1) as overall_avg_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as overall_avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as overall_fps_per_watt,
          (SELECT architecture FROM benchmark_results br2 WHERE br2.vendor = ? AND br2.cpu_generation = benchmark_results.cpu_generation AND br2.architecture IS NOT NULL LIMIT 1) as architecture
        FROM benchmark_results
        WHERE vendor = ? AND cpu_generation IN (${genPlaceholders})
        GROUP BY cpu_generation
      `,
      args: [vendor, vendor, ...allGensToFetch],
    }),
    // Baseline overall stats (separate for comparison)
    db.execute({
      sql: `
        SELECT
          ROUND(AVG(avg_fps), 1) as overall_avg_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as overall_avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as overall_fps_per_watt
        FROM benchmark_results
        WHERE vendor = ? AND cpu_generation = ?
      `,
      args: [vendor, baselineGen],
    }),
  ]);

  const baselineOverall = baselineOverallResult.rows[0] || {};

  // Build lookup structures
  const overallByGen: Record<number, {
    total_results: number;
    unique_cpus: number;
    avg_fps: number;
    avg_watts: number | null;
    fps_per_watt: number | null;
    architecture: string | null;
  }> = {};

  for (const row of overallResult.rows) {
    const gen = row.cpu_generation as number;
    overallByGen[gen] = {
      total_results: (row.total_results as number) || 0,
      unique_cpus: (row.unique_cpus as number) || 0,
      avg_fps: (row.overall_avg_fps as number) || 0,
      avg_watts: row.overall_avg_watts as number | null,
      fps_per_watt: row.overall_fps_per_watt as number | null,
      architecture: row.architecture as string | null,
    };
  }

  // Build test data by generation
  const byTestByGen: Record<number, Record<string, {
    result_count: number;
    avg_fps: number;
    min_fps: number;
    max_fps: number;
    avg_watts: number | null;
    fps_per_watt: number | null;
    avg_speed: number | null;
  }>> = {};

  for (const row of statsResult.rows) {
    const gen = row.cpu_generation as number;
    const testName = row.test_name as string;

    if (!byTestByGen[gen]) {
      byTestByGen[gen] = {};
    }

    byTestByGen[gen][testName] = {
      result_count: row.result_count as number,
      avg_fps: (row.avg_fps as number) || 0,
      min_fps: (row.min_fps as number) || 0,
      max_fps: (row.max_fps as number) || 0,
      avg_watts: row.avg_watts as number | null,
      fps_per_watt: row.avg_fps_per_watt as number | null,
      avg_speed: row.avg_speed as number | null,
    };
  }

  // Get all unique test names across all generations
  const allTests = [...new Set(statsResult.rows.map(r => r.test_name as string))].sort();

  // Build response for each selected generation (not baseline)
  const generationsData = generations.sort((a, b) => a - b).map(gen => {
    const overall = overallByGen[gen] || { total_results: 0, unique_cpus: 0, avg_fps: 0, avg_watts: null, fps_per_watt: null, architecture: null };
    const testData = byTestByGen[gen] || {};
    const baselineTestData = byTestByGen[baselineGen] || {};

    return {
      generation: gen,
      architecture: overall.architecture,
      overall,
      by_test: allTests.map(testName => ({
        test_name: testName,
        ...(testData[testName] || { result_count: 0, avg_fps: 0, min_fps: 0, max_fps: 0, avg_watts: null, fps_per_watt: null, avg_speed: null }),
        baseline_fps: baselineTestData[testName]?.avg_fps || null,
        baseline_fps_per_watt: baselineTestData[testName]?.fps_per_watt || null,
      })),
    };
  });

  return c.json({
    success: true,
    generations: generations.sort((a, b) => a - b),
    baseline_generation: baselineGen,
    baseline_overall: {
      avg_fps: baselineOverall.overall_avg_fps || 0,
      avg_watts: baselineOverall.overall_avg_watts || null,
      fps_per_watt: baselineOverall.overall_fps_per_watt || null,
    },
    baseline_by_test: allTests.map(testName => ({
      test_name: testName,
      ...(byTestByGen[baselineGen]?.[testName] || { result_count: 0, avg_fps: 0, min_fps: 0, max_fps: 0, avg_watts: null, fps_per_watt: null, avg_speed: null }),
    })),
    data: generationsData,
    all_tests: allTests,
  });
});

export default results;
