/**
 * GET /api/results
 * Query benchmark results with filtering.
 */

import { Hono } from 'hono';
import { getDb, Env, BenchmarkResult } from '../lib/db';

// Preferred display order for test types in charts
const TEST_ORDER = ['h264_1080p_cpu', 'h264_1080p', 'h264_4k', 'hevc_8bit', 'hevc_4k_10bit'];

// Sort test names by preferred order, with unknown tests sorted alphabetically at the end
function sortTestNames(tests: string[]): string[] {
  return [...tests].sort((a, b) => {
    const aIdx = TEST_ORDER.indexOf(a);
    const bIdx = TEST_ORDER.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

const results = new Hono<{ Bindings: Env }>();

results.get('/', async (c) => {
  const db = getDb(c.env);

  // Query parameters for filtering
  const generation = c.req.query('generation');      // e.g., "12,13,14"
  const architecture = c.req.query('architecture');  // e.g., "Alder Lake,Raptor Lake"
  const testName = c.req.query('test');              // e.g., "h264_1080p,hevc_8bit"
  const cpuRaw = c.req.query('cpu');                 // e.g., "i5-8500||i7-12700" (|| delimiter)
  const submitterId = c.req.query('submitter_id');
  const ecc = c.req.query('ecc');                    // e.g., "yes" or "no" or "yes,no"
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

  if (ecc) {
    const eccValues = ecc.split(',').map(e => e.trim().toLowerCase()).filter(e => e === 'yes' || e === 'no');
    if (eccValues.length > 0) {
      // Join with cpu_features table to filter by ECC support
      const eccConditions: string[] = [];
      if (eccValues.includes('yes')) {
        eccConditions.push('cf.ecc_support = 1');
      }
      if (eccValues.includes('no')) {
        eccConditions.push('(cf.ecc_support = 0 OR cf.ecc_support IS NULL)');
      }
      conditions.push(`cpu_raw IN (SELECT cpu_raw FROM cpu_features cf WHERE ${eccConditions.join(' OR ')})`);
    }
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
  const ecc = c.req.query('ecc');

  // Build base conditions
  const baseConditions: string[] = ['vendor = ?'];
  const baseArgs: (string | number)[] = [vendor];

  // Parse current filters
  const selectedGens = generation ? generation.split(',').map(g => parseInt(g.trim(), 10)).filter(g => !isNaN(g)) : [];
  const selectedArchs = architecture ? architecture.split(',').map(a => a.trim()).filter(a => a) : [];
  const selectedTests = testName ? testName.split(',').map(t => t.trim()).filter(t => t) : [];
  const selectedEcc = ecc ? ecc.split(',').map(e => e.trim().toLowerCase()).filter(e => e === 'yes' || e === 'no') : [];

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

  // Count distinct submissions (by timestamp minute), not individual test rows
  // Each benchmark run submits ~5 tests, so we group by timestamp to count runs
  const distinctCount = `COUNT(DISTINCT substr(submitted_at, 1, 16))`;

  // Build ECC filter conditions (filtered by generation, architecture, and test)
  const eccConditions = [...baseConditions];
  const eccArgs = [...baseArgs];
  if (selectedGens.length > 0) {
    eccConditions.push(`cpu_generation IN (${selectedGens.map(() => '?').join(',')})`);
    eccArgs.push(...selectedGens);
  }
  if (selectedArchs.length > 0) {
    eccConditions.push(`architecture IN (${selectedArchs.map(() => '?').join(',')})`);
    eccArgs.push(...selectedArchs);
  }
  if (selectedTests.length > 0) {
    eccConditions.push(`test_name IN (${selectedTests.map(() => '?').join(',')})`);
    eccArgs.push(...selectedTests);
  }

  const [genCounts, archCounts, testCounts, cpuCounts, submitterCounts, eccYesCount, eccNoCount] = await Promise.all([
    db.execute({
      sql: `SELECT cpu_generation as value, ${distinctCount} as count FROM benchmark_results WHERE ${genConditions.join(' AND ')} AND cpu_generation IS NOT NULL GROUP BY cpu_generation`,
      args: genArgs,
    }),
    db.execute({
      sql: `SELECT architecture as value, ${distinctCount} as count FROM benchmark_results WHERE ${archConditions.join(' AND ')} AND architecture IS NOT NULL GROUP BY architecture`,
      args: archArgs,
    }),
    db.execute({
      sql: `SELECT test_name as value, ${distinctCount} as count FROM benchmark_results WHERE ${testConditions.join(' AND ')} GROUP BY test_name`,
      args: testArgs,
    }),
    db.execute({
      sql: `SELECT cpu_raw as value, ${distinctCount} as count FROM benchmark_results WHERE ${cpuConditions.join(' AND ')} GROUP BY cpu_raw ORDER BY count DESC LIMIT 100`,
      args: cpuArgs,
    }),
    db.execute({
      sql: `SELECT submitter_id as value, ${distinctCount} as count FROM benchmark_results WHERE ${baseConditions.join(' AND ')} AND submitter_id IS NOT NULL AND submitter_id != '' GROUP BY submitter_id ORDER BY count DESC LIMIT 50`,
      args: baseArgs,
    }),
    // Count CPUs with ECC support
    db.execute({
      sql: `SELECT ${distinctCount} as count FROM benchmark_results br
            WHERE ${eccConditions.join(' AND ')}
            AND br.cpu_raw IN (SELECT cpu_raw FROM cpu_features WHERE ecc_support = 1)`,
      args: eccArgs,
    }),
    // Count CPUs without ECC support (including those not in cpu_features table)
    db.execute({
      sql: `SELECT ${distinctCount} as count FROM benchmark_results br
            WHERE ${eccConditions.join(' AND ')}
            AND br.cpu_raw IN (SELECT cpu_raw FROM cpu_features WHERE ecc_support = 0 OR ecc_support IS NULL)`,
      args: eccArgs,
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
      ecc: {
        yes: eccYesCount.rows[0]?.count || 0,
        no: eccNoCount.rows[0]?.count || 0,
      },
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
  const allTests = sortTestNames([...new Set(statsResult.rows.map(r => r.test_name as string))]);

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

// Get aggregated statistics for specific architectures (e.g., Arc GPUs)
results.get('/architecture-stats', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';
  const archParam = c.req.query('architecture'); // Can be "Alchemist" or "Alchemist,Battlemage"
  const baselineGen = 8; // Compare against 8th Gen as baseline

  if (!archParam) {
    return c.json({ success: false, error: 'architecture parameter required' }, 400);
  }

  // Parse multiple architectures
  const architectures = archParam.split(',').map(a => a.trim()).filter(a => a);
  if (architectures.length === 0) {
    return c.json({ success: false, error: 'Invalid architecture names' }, 400);
  }

  const archPlaceholders = architectures.map(() => '?').join(',');

  const [statsResult, overallResult, baselineOverallResult, baselineTestResult] = await Promise.all([
    // Stats per architecture per test type
    db.execute({
      sql: `
        SELECT
          architecture,
          test_name,
          COUNT(*) as result_count,
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(MIN(avg_fps), 1) as min_fps,
          ROUND(MAX(avg_fps), 1) as max_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as avg_fps_per_watt,
          ROUND(AVG(avg_speed), 2) as avg_speed
        FROM benchmark_results
        WHERE vendor = ? AND architecture IN (${archPlaceholders})
        GROUP BY architecture, test_name
        ORDER BY architecture, test_name
      `,
      args: [vendor, ...architectures],
    }),
    // Overall stats per architecture
    db.execute({
      sql: `
        SELECT
          architecture,
          COUNT(*) as total_results,
          COUNT(DISTINCT cpu_raw) as unique_cpus,
          ROUND(AVG(avg_fps), 1) as overall_avg_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as overall_avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as overall_fps_per_watt
        FROM benchmark_results
        WHERE vendor = ? AND architecture IN (${archPlaceholders})
        GROUP BY architecture
      `,
      args: [vendor, ...architectures],
    }),
    // Baseline overall stats (8th gen)
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
    // Baseline test stats (8th gen)
    db.execute({
      sql: `
        SELECT
          test_name,
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 AND avg_watts < 50 THEN avg_watts ELSE NULL END), 1) as avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as avg_fps_per_watt
        FROM benchmark_results
        WHERE vendor = ? AND cpu_generation = ?
        GROUP BY test_name
      `,
      args: [vendor, baselineGen],
    }),
  ]);

  const baselineOverall = baselineOverallResult.rows[0] || {};
  const baselineByTest: Record<string, { avg_fps: number; avg_watts: number | null; fps_per_watt: number | null }> = {};
  for (const row of baselineTestResult.rows) {
    baselineByTest[row.test_name as string] = {
      avg_fps: (row.avg_fps as number) || 0,
      avg_watts: row.avg_watts as number | null,
      fps_per_watt: row.avg_fps_per_watt as number | null,
    };
  }

  // Build lookup structures
  const overallByArch: Record<string, {
    total_results: number;
    unique_cpus: number;
    avg_fps: number;
    avg_watts: number | null;
    fps_per_watt: number | null;
  }> = {};

  for (const row of overallResult.rows) {
    const arch = row.architecture as string;
    overallByArch[arch] = {
      total_results: (row.total_results as number) || 0,
      unique_cpus: (row.unique_cpus as number) || 0,
      avg_fps: (row.overall_avg_fps as number) || 0,
      avg_watts: row.overall_avg_watts as number | null,
      fps_per_watt: row.overall_fps_per_watt as number | null,
    };
  }

  // Build test data by architecture
  const byTestByArch: Record<string, Record<string, {
    result_count: number;
    avg_fps: number;
    min_fps: number;
    max_fps: number;
    avg_watts: number | null;
    fps_per_watt: number | null;
    avg_speed: number | null;
  }>> = {};

  for (const row of statsResult.rows) {
    const arch = row.architecture as string;
    const testName = row.test_name as string;

    if (!byTestByArch[arch]) {
      byTestByArch[arch] = {};
    }

    byTestByArch[arch][testName] = {
      result_count: row.result_count as number,
      avg_fps: (row.avg_fps as number) || 0,
      min_fps: (row.min_fps as number) || 0,
      max_fps: (row.max_fps as number) || 0,
      avg_watts: row.avg_watts as number | null,
      fps_per_watt: row.avg_fps_per_watt as number | null,
      avg_speed: row.avg_speed as number | null,
    };
  }

  // Get all unique test names
  const allTests = sortTestNames([...new Set(statsResult.rows.map(r => r.test_name as string))]);

  // Build response for each architecture
  const architecturesData = architectures.map(arch => {
    const overall = overallByArch[arch] || { total_results: 0, unique_cpus: 0, avg_fps: 0, avg_watts: null, fps_per_watt: null };
    const testData = byTestByArch[arch] || {};

    return {
      architecture: arch,
      overall,
      by_test: allTests.map(testName => ({
        test_name: testName,
        ...(testData[testName] || { result_count: 0, avg_fps: 0, min_fps: 0, max_fps: 0, avg_watts: null, fps_per_watt: null, avg_speed: null }),
        baseline_fps: baselineByTest[testName]?.avg_fps || null,
        baseline_fps_per_watt: baselineByTest[testName]?.fps_per_watt || null,
      })),
    };
  });

  // Build baseline_by_test array
  const baselineByTestArray = allTests.map(testName => ({
    test_name: testName,
    avg_fps: baselineByTest[testName]?.avg_fps || 0,
    avg_watts: baselineByTest[testName]?.avg_watts || null,
    fps_per_watt: baselineByTest[testName]?.fps_per_watt || null,
  }));

  return c.json({
    success: true,
    architectures,
    baseline_generation: baselineGen,
    baseline_overall: {
      avg_fps: baselineOverall.overall_avg_fps || 0,
      avg_watts: baselineOverall.overall_avg_watts || null,
      fps_per_watt: baselineOverall.overall_fps_per_watt || null,
    },
    baseline_by_test: baselineByTestArray,
    data: architecturesData,
    all_tests: allTests,
  });
});

// Get aggregated statistics for specific CPUs
results.get('/cpu-stats', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';
  const cpuParam = c.req.query('cpu'); // CPU names separated by ||

  if (!cpuParam) {
    return c.json({ success: false, error: 'cpu parameter required' }, 400);
  }

  // Parse CPU names (using || delimiter since CPU names can contain commas)
  const cpus = cpuParam.split('||').map(c => c.trim()).filter(c => c);
  if (cpus.length === 0) {
    return c.json({ success: false, error: 'Invalid CPU names' }, 400);
  }

  const cpuPlaceholders = cpus.map(() => '?').join(',');

  const [statsResult, overallResult] = await Promise.all([
    // Stats per CPU per test type
    db.execute({
      sql: `
        SELECT
          cpu_raw,
          cpu_generation,
          architecture,
          test_name,
          COUNT(*) as result_count,
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(MIN(avg_fps), 1) as min_fps,
          ROUND(MAX(avg_fps), 1) as max_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as fps_per_watt,
          ROUND(AVG(avg_speed), 2) as avg_speed
        FROM benchmark_results
        WHERE vendor = ? AND cpu_raw IN (${cpuPlaceholders})
        GROUP BY cpu_raw, test_name
        ORDER BY cpu_raw, test_name
      `,
      args: [vendor, ...cpus],
    }),
    // Overall stats per CPU
    db.execute({
      sql: `
        SELECT
          cpu_raw,
          cpu_generation,
          architecture,
          COUNT(*) as total_results,
          ROUND(AVG(avg_fps), 1) as overall_avg_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as overall_avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as overall_fps_per_watt
        FROM benchmark_results
        WHERE vendor = ? AND cpu_raw IN (${cpuPlaceholders})
        GROUP BY cpu_raw
      `,
      args: [vendor, ...cpus],
    }),
  ]);

  // Get all unique test names
  const allTests = sortTestNames([...new Set(statsResult.rows.map(r => r.test_name as string))]);

  // Build lookup structures
  const overallByCpu: Record<string, {
    cpu_generation: number | null;
    architecture: string | null;
    total_results: number;
    avg_fps: number;
    avg_watts: number | null;
    fps_per_watt: number | null;
  }> = {};

  for (const row of overallResult.rows) {
    const cpuName = row.cpu_raw as string;
    overallByCpu[cpuName] = {
      cpu_generation: row.cpu_generation as number | null,
      architecture: row.architecture as string | null,
      total_results: (row.total_results as number) || 0,
      avg_fps: (row.overall_avg_fps as number) || 0,
      avg_watts: row.overall_avg_watts as number | null,
      fps_per_watt: row.overall_fps_per_watt as number | null,
    };
  }

  // Build test data by CPU
  const byTestByCpu: Record<string, Record<string, {
    result_count: number;
    avg_fps: number;
    min_fps: number;
    max_fps: number;
    avg_watts: number | null;
    fps_per_watt: number | null;
    avg_speed: number | null;
  }>> = {};

  for (const row of statsResult.rows) {
    const cpuName = row.cpu_raw as string;
    const testName = row.test_name as string;

    if (!byTestByCpu[cpuName]) {
      byTestByCpu[cpuName] = {};
    }

    byTestByCpu[cpuName][testName] = {
      result_count: row.result_count as number,
      avg_fps: (row.avg_fps as number) || 0,
      min_fps: (row.min_fps as number) || 0,
      max_fps: (row.max_fps as number) || 0,
      avg_watts: row.avg_watts as number | null,
      fps_per_watt: row.fps_per_watt as number | null,
      avg_speed: row.avg_speed as number | null,
    };
  }

  // Build response for each CPU
  const cpusData = cpus.map(cpuName => {
    const overall = overallByCpu[cpuName] || { cpu_generation: null, architecture: null, total_results: 0, avg_fps: 0, avg_watts: null, fps_per_watt: null };
    const testData = byTestByCpu[cpuName] || {};

    return {
      cpu_raw: cpuName,
      cpu_generation: overall.cpu_generation,
      architecture: overall.architecture,
      overall,
      by_test: allTests.map(testName => ({
        test_name: testName,
        ...(testData[testName] || { result_count: 0, avg_fps: 0, min_fps: 0, max_fps: 0, avg_watts: null, fps_per_watt: null, avg_speed: null }),
      })),
    };
  });

  return c.json({
    success: true,
    cpus: cpus,
    data: cpusData,
    all_tests: allTests,
  });
});

// Get comprehensive detail for a single generation (for generation detail page)
results.get('/generation-detail', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';
  const genParam = c.req.query('generation'); // Can be "8", "12", "ultra-1", "ultra-2"
  const baselineGen = 8;

  if (!genParam) {
    return c.json({ success: false, error: 'generation parameter required' }, 400);
  }

  // Handle special generation identifiers
  let generationFilter: { type: 'generation' | 'architecture'; values: (number | string)[] };
  let displayName: string;

  if (genParam === 'ultra-1') {
    generationFilter = { type: 'architecture', values: ['Meteor Lake'] };
    displayName = 'Core Ultra Series 1';
  } else if (genParam === 'ultra-2') {
    generationFilter = { type: 'architecture', values: ['Arrow Lake', 'Lunar Lake'] };
    displayName = 'Core Ultra Series 2';
  } else if (genParam === 'arc-alchemist') {
    generationFilter = { type: 'architecture', values: ['Arc Alchemist'] };
    displayName = 'Arc Alchemist';
  } else if (genParam === 'arc-battlemage') {
    generationFilter = { type: 'architecture', values: ['Arc Battlemage'] };
    displayName = 'Arc Battlemage';
  } else if (genParam === 'arc') {
    generationFilter = { type: 'architecture', values: ['Arc Alchemist', 'Arc Battlemage'] };
    displayName = 'Intel Arc';
  } else {
    const gen = parseInt(genParam, 10);
    if (isNaN(gen)) {
      return c.json({ success: false, error: 'Invalid generation' }, 400);
    }
    generationFilter = { type: 'generation', values: [gen] };
    displayName = `${gen}th Gen`;
  }

  // Build filter clause
  const filterClause = generationFilter.type === 'generation'
    ? `cpu_generation IN (${generationFilter.values.map(() => '?').join(',')})`
    : `architecture IN (${generationFilter.values.map(() => '?').join(',')})`;

  // Map generation numbers to architecture names for querying cpu_architectures
  // This handles the case where multiple die variants exist for a generation
  const genToArchMap: Record<number, string[]> = {
    6: ['Skylake'],
    7: ['Kaby Lake'],
    8: ['Coffee Lake'],
    9: ['Coffee Lake Refresh'],
    10: ['Comet Lake', 'Ice Lake'],
    11: ['Rocket Lake', 'Tiger Lake'],
    12: ['Alder Lake'],
    13: ['Raptor Lake'],
    14: ['Raptor Lake Refresh'],
  };

  // Fetch ALL architecture variants for this generation (not just one)
  // For generations 12-14, there may be multiple die variants (e.g., UHD 730 vs UHD 770)
  let archMetadataQuery: string;
  let archMetadataArgs: (string | number)[];

  if (generationFilter.type === 'generation') {
    const gen = generationFilter.values[0] as number;
    const archNames = genToArchMap[gen] || [];
    if (archNames.length > 0) {
      archMetadataQuery = `SELECT * FROM cpu_architectures WHERE vendor = ? AND architecture IN (${archNames.map(() => '?').join(',')}) ORDER BY sort_order`;
      archMetadataArgs = [vendor, ...archNames];
    } else {
      // Fallback: try pattern matching for unknown generations
      archMetadataQuery = `SELECT DISTINCT * FROM cpu_architectures WHERE vendor = ? AND pattern LIKE '%' || ? || '%' ORDER BY sort_order`;
      archMetadataArgs = [vendor, `-${gen}`];
    }
  } else {
    archMetadataQuery = `SELECT * FROM cpu_architectures WHERE vendor = ? AND architecture IN (${generationFilter.values.map(() => '?').join(',')}) ORDER BY sort_order`;
    archMetadataArgs = [vendor, ...generationFilter.values];
  }

  const [archMetadata, statsResult, overallResult, cpuModelsResult, cpuFeaturesResult, baselineResult, baselineByTestResult, timelineResult] = await Promise.all([
    // Architecture metadata
    db.execute({
      sql: archMetadataQuery,
      args: archMetadataArgs,
    }),
    // Stats per test type
    db.execute({
      sql: `
        SELECT
          test_name,
          COUNT(*) as result_count,
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(MIN(avg_fps), 1) as min_fps,
          ROUND(MAX(avg_fps), 1) as max_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as fps_per_watt,
          ROUND(AVG(avg_speed), 2) as avg_speed
        FROM benchmark_results
        WHERE vendor = ? AND ${filterClause}
        GROUP BY test_name
        ORDER BY test_name
      `,
      args: [vendor, ...generationFilter.values],
    }),
    // Overall stats
    db.execute({
      sql: `
        SELECT
          COUNT(*) as total_results,
          COUNT(DISTINCT cpu_raw) as unique_cpus,
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as fps_per_watt
        FROM benchmark_results
        WHERE vendor = ? AND ${filterClause}
      `,
      args: [vendor, ...generationFilter.values],
    }),
    // CPU models in this generation with stats
    db.execute({
      sql: `
        SELECT
          cpu_raw,
          COUNT(*) as result_count,
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as fps_per_watt
        FROM benchmark_results
        WHERE vendor = ? AND ${filterClause}
        GROUP BY cpu_raw
        ORDER BY avg_fps DESC
      `,
      args: [vendor, ...generationFilter.values],
    }),
    // CPU features (ECC support, etc.) for CPUs in this generation
    db.execute({
      sql: `
        SELECT cpu_raw, ecc_support
        FROM cpu_features
        WHERE cpu_raw IN (
          SELECT DISTINCT cpu_raw FROM benchmark_results
          WHERE vendor = ? AND ${filterClause}
        )
      `,
      args: [vendor, ...generationFilter.values],
    }),
    // Baseline (8th gen) overall stats for comparison
    db.execute({
      sql: `
        SELECT
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as fps_per_watt
        FROM benchmark_results
        WHERE vendor = ? AND cpu_generation = ?
      `,
      args: [vendor, baselineGen],
    }),
    // Baseline (8th gen) stats per test type for charts
    db.execute({
      sql: `
        SELECT
          test_name,
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as fps_per_watt
        FROM benchmark_results
        WHERE vendor = ? AND cpu_generation = ?
        GROUP BY test_name
        ORDER BY test_name
      `,
      args: [vendor, baselineGen],
    }),
    // All architectures for timeline (ordered by sort_order)
    db.execute({
      sql: `
        SELECT DISTINCT
          architecture,
          codename,
          release_year,
          sort_order,
          igpu_name,
          igpu_codename,
          process_nm,
          max_p_cores,
          max_e_cores,
          tdp_range,
          die_layout,
          gpu_eu_count,
          h264_encode,
          hevc_8bit_encode,
          hevc_10bit_encode,
          vp9_encode,
          av1_encode
        FROM cpu_architectures
        WHERE vendor = ?
        ORDER BY sort_order
      `,
      args: [vendor],
    }),
  ]);

  const overall = overallResult.rows[0] || {};
  const baseline = baselineResult.rows[0] || {};

  // Get all architecture variants for this generation
  // For 12th-14th gen, there may be multiple die variants (lower-tier vs K-series)
  const archVariants = archMetadata.rows.map((row: Record<string, unknown>) => ({
    name: row.architecture as string || null,
    codename: row.codename as string || null,
    pattern: row.pattern as string || null,
    release_year: row.release_year as number || null,
    igpu_name: row.igpu_name as string || null,
    igpu_codename: row.igpu_codename as string || null,
    process_nm: row.process_nm as string || null,
    max_p_cores: row.max_p_cores as number || null,
    max_e_cores: row.max_e_cores as number || null,
    tdp_range: row.tdp_range as string || null,
    die_layout: row.die_layout as string || null,
    gpu_eu_count: row.gpu_eu_count as string || null,
    h264_encode: !!row.h264_encode,
    hevc_8bit_encode: !!row.hevc_8bit_encode,
    hevc_10bit_encode: !!row.hevc_10bit_encode,
    vp9_encode: !!row.vp9_encode,
    av1_encode: !!row.av1_encode,
  }));

  // Primary architecture info (first/highest-tier variant for backwards compatibility)
  const archInfo = archMetadata.rows[archMetadata.rows.length - 1] || {};

  // Check if generation has multiple die variants with different iGPUs
  const uniqueIgpus = [...new Set(archVariants.map(v => v.igpu_name).filter(Boolean))];
  const hasMultipleVariants = uniqueIgpus.length > 1;

  // Build timeline data
  interface TimelineEntry {
    identifier: string;
    name: string;
    codename: string;
    release_year: number;
    sort_order: number;
  }

  const timelineEntries: TimelineEntry[] = [];
  const seenArchitectures = new Set<string>();
  let hasArc = false;

  for (const row of timelineResult.rows) {
    const arch = row.architecture as string;
    if (seenArchitectures.has(arch)) continue;
    seenArchitectures.add(arch);

    // Map architectures to generation identifiers
    let identifier: string;
    if (arch === 'Meteor Lake') {
      identifier = 'ultra-1';
    } else if (arch === 'Arrow Lake' || arch === 'Lunar Lake') {
      // Skip Lunar Lake in timeline (combined with Arrow Lake)
      if (arch === 'Lunar Lake') continue;
      identifier = 'ultra-2';
    } else if (arch.includes('Arc')) {
      // All Arc GPUs combined into single "arc" entry
      hasArc = true;
      continue; // Skip individual Arc entries, we'll add one combined entry at the end
    } else {
      // Extract generation number from sort_order (roughly maps to gen)
      const sortOrder = row.sort_order as number;
      // Map sort_order to generation: 20-29=2, 30-39=3, ..., 140-149=14
      // Use Math.round(sortOrder / 10) to handle cases like 119->12, 129->13, 139->14
      const gen = Math.round(sortOrder / 10);
      // Start timeline at 6th gen (skip older generations)
      if (gen < 6 || gen > 14) continue;
      identifier = gen.toString();
    }

    timelineEntries.push({
      identifier,
      name: arch,
      codename: row.codename as string,
      release_year: row.release_year as number,
      sort_order: row.sort_order as number,
    });
  }

  // Add single combined Arc entry at the end if any Arc GPUs exist
  if (hasArc) {
    timelineEntries.push({
      identifier: 'arc',
      name: 'Intel Arc',
      codename: 'Arc',
      release_year: 2022,
      sort_order: 9999, // Place at end
    });
  }

  // Deduplicate timeline entries by identifier
  const uniqueTimeline = timelineEntries.reduce((acc, entry) => {
    if (!acc.find(e => e.identifier === entry.identifier)) {
      acc.push(entry);
    }
    return acc;
  }, [] as TimelineEntry[]);

  // Find current position in timeline
  const currentPosition = uniqueTimeline.findIndex(e => e.identifier === genParam);

  // Sort test names
  const allTests = sortTestNames((statsResult.rows as Array<Record<string, unknown>>).map(r => r.test_name as string));

  // Calculate baseline comparison
  const baselineAvgFps = (baseline.avg_fps as number) || 0;
  const baselineFpsPerWatt = (baseline.fps_per_watt as number) || 0;
  const currentAvgFps = (overall.avg_fps as number) || 0;
  const currentFpsPerWatt = (overall.fps_per_watt as number) || 0;

  const fpsDiffPercent = baselineAvgFps > 0
    ? Math.round(((currentAvgFps - baselineAvgFps) / baselineAvgFps) * 100)
    : null;
  const efficiencyDiffPercent = baselineFpsPerWatt > 0
    ? Math.round(((currentFpsPerWatt - baselineFpsPerWatt) / baselineFpsPerWatt) * 100)
    : null;

  return c.json({
    success: true,
    generation: genParam,
    display_name: displayName,
    // Primary architecture (highest-tier variant for backwards compatibility)
    architecture: {
      name: archInfo.architecture || null,
      codename: archInfo.codename || null,
      release_year: archInfo.release_year || null,
      igpu_name: archInfo.igpu_name || null,
      igpu_codename: archInfo.igpu_codename || null,
      process_nm: archInfo.process_nm || null,
      max_p_cores: archInfo.max_p_cores || null,
      max_e_cores: archInfo.max_e_cores || null,
      tdp_range: archInfo.tdp_range || null,
      die_layout: archInfo.die_layout || null,
      gpu_eu_count: archInfo.gpu_eu_count || null,
    },
    // All architecture variants (for generations with multiple die variants)
    architecture_variants: archVariants,
    has_multiple_variants: hasMultipleVariants,
    codec_support: {
      h264_encode: !!archInfo.h264_encode,
      hevc_8bit_encode: !!archInfo.hevc_8bit_encode,
      hevc_10bit_encode: !!archInfo.hevc_10bit_encode,
      vp9_encode: !!archInfo.vp9_encode,
      av1_encode: !!archInfo.av1_encode,
    },
    benchmark_stats: {
      total_results: (overall.total_results as number) || 0,
      unique_cpus: (overall.unique_cpus as number) || 0,
      avg_fps: currentAvgFps,
      avg_watts: overall.avg_watts || null,
      fps_per_watt: currentFpsPerWatt,
      by_test: allTests.map(testName => {
        const testData = (statsResult.rows as Array<Record<string, unknown>>).find(r => r.test_name === testName);
        return {
          test_name: testName,
          result_count: (testData?.result_count as number) || 0,
          avg_fps: (testData?.avg_fps as number) || 0,
          min_fps: (testData?.min_fps as number) || 0,
          max_fps: (testData?.max_fps as number) || 0,
          avg_watts: testData?.avg_watts || null,
          fps_per_watt: testData?.fps_per_watt || null,
          avg_speed: testData?.avg_speed || null,
        };
      }),
    },
    cpu_models: cpuModelsResult.rows.map((row: Record<string, unknown>) => {
      const cpuRaw = row.cpu_raw as string;
      const features = cpuFeaturesResult.rows.find((f: Record<string, unknown>) => f.cpu_raw === cpuRaw);
      return {
        cpu_raw: cpuRaw,
        result_count: row.result_count as number,
        avg_fps: row.avg_fps as number,
        fps_per_watt: row.fps_per_watt as number | null,
        ecc_support: features ? !!features.ecc_support : false,
      };
    }),
    timeline: {
      all_generations: uniqueTimeline,
      current_position: currentPosition,
      previous: currentPosition > 0 ? uniqueTimeline[currentPosition - 1] : null,
      next: currentPosition < uniqueTimeline.length - 1 ? uniqueTimeline[currentPosition + 1] : null,
    },
    baseline_comparison: {
      baseline_generation: baselineGen,
      fps_diff_percent: fpsDiffPercent,
      efficiency_diff_percent: efficiencyDiffPercent,
    },
    baseline_by_test: allTests.map(testName => {
      const testData = (baselineByTestResult.rows as Array<Record<string, unknown>>).find(r => r.test_name === testName);
      return {
        test_name: testName,
        avg_fps: (testData?.avg_fps as number) || 0,
        avg_watts: testData?.avg_watts || null,
        fps_per_watt: testData?.fps_per_watt || null,
      };
    }),
  });
});

// Get all architectures with metadata (for timeline and overview)
results.get('/architectures', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';

  const result = await db.execute({
    sql: `
      SELECT DISTINCT
        architecture,
        codename,
        release_year,
        release_quarter,
        sort_order,
        igpu_name,
        igpu_codename,
        process_nm,
        max_p_cores,
        max_e_cores,
        tdp_range,
        die_layout,
        gpu_eu_count,
        h264_encode,
        hevc_8bit_encode,
        hevc_10bit_encode,
        vp9_encode,
        av1_encode
      FROM cpu_architectures
      WHERE vendor = ?
      ORDER BY sort_order
    `,
    args: [vendor],
  });

  // Deduplicate by architecture name (some have multiple patterns)
  const seen = new Set<string>();
  const architectures = result.rows.filter((row: Record<string, unknown>) => {
    const arch = row.architecture as string;
    if (seen.has(arch)) return false;
    seen.add(arch);
    return true;
  });

  return c.json({
    success: true,
    architectures: architectures.map((row: Record<string, unknown>) => ({
      architecture: row.architecture,
      codename: row.codename,
      release_year: row.release_year,
      release_quarter: row.release_quarter,
      sort_order: row.sort_order,
      igpu_name: row.igpu_name,
      igpu_codename: row.igpu_codename,
      process_nm: row.process_nm,
      max_p_cores: row.max_p_cores,
      max_e_cores: row.max_e_cores,
      tdp_range: row.tdp_range,
      die_layout: row.die_layout,
      gpu_eu_count: row.gpu_eu_count,
      codec_support: {
        h264_encode: !!row.h264_encode,
        hevc_8bit_encode: !!row.hevc_8bit_encode,
        hevc_10bit_encode: !!row.hevc_10bit_encode,
        vp9_encode: !!row.vp9_encode,
        av1_encode: !!row.av1_encode,
      },
    })),
  });
});

// Get Arc GPU models with individual stats (not merged)
results.get('/arc-models', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';
  const archFilter = c.req.query('architecture'); // Optional: "Alchemist" or "Battlemage"

  // Build architecture filter
  let archCondition = `architecture LIKE 'Arc%'`;
  const args: (string | number)[] = [vendor];

  if (archFilter) {
    const archs = archFilter.split(',').map((a: string) => a.trim()).filter((a: string) => a);
    if (archs.length > 0) {
      archCondition = `architecture IN (${archs.map(() => '?').join(',')})`;
      args.push(...archs);
    }
  }

  const [modelsResult, archMetadata] = await Promise.all([
    // Get individual GPU models with stats
    db.execute({
      sql: `
        SELECT
          cpu_raw as model_name,
          architecture,
          test_name,
          COUNT(*) as result_count,
          ROUND(AVG(avg_fps), 1) as avg_fps,
          ROUND(MIN(avg_fps), 1) as min_fps,
          ROUND(MAX(avg_fps), 1) as max_fps,
          ROUND(AVG(CASE WHEN avg_watts > 0 THEN avg_watts ELSE NULL END), 1) as avg_watts,
          ROUND(AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END), 2) as fps_per_watt,
          ROUND(AVG(avg_speed), 2) as avg_speed
        FROM benchmark_results
        WHERE vendor = ? AND ${archCondition}
        GROUP BY cpu_raw, test_name
        ORDER BY cpu_raw, test_name
      `,
      args,
    }),
    // Get architecture metadata
    db.execute({
      sql: `
        SELECT DISTINCT
          architecture,
          codename,
          release_year,
          igpu_name,
          igpu_codename,
          process_nm,
          tdp_range,
          die_layout,
          gpu_eu_count,
          h264_encode,
          hevc_8bit_encode,
          hevc_10bit_encode,
          vp9_encode,
          av1_encode
        FROM cpu_architectures
        WHERE vendor = ? AND architecture LIKE 'Arc%'
        ORDER BY sort_order
      `,
      args: [vendor],
    }),
  ]);

  // Group results by model
  const modelMap = new Map<string, {
    model_name: string;
    architecture: string;
    total_results: number;
    by_test: Array<{
      test_name: string;
      result_count: number;
      avg_fps: number;
      min_fps: number;
      max_fps: number;
      avg_watts: number | null;
      fps_per_watt: number | null;
      avg_speed: number | null;
    }>;
  }>();

  for (const row of modelsResult.rows) {
    const modelName = row.model_name as string;
    if (!modelMap.has(modelName)) {
      modelMap.set(modelName, {
        model_name: modelName,
        architecture: row.architecture as string,
        total_results: 0,
        by_test: [],
      });
    }

    const model = modelMap.get(modelName)!;
    model.total_results += row.result_count as number;
    model.by_test.push({
      test_name: row.test_name as string,
      result_count: row.result_count as number,
      avg_fps: row.avg_fps as number,
      min_fps: row.min_fps as number,
      max_fps: row.max_fps as number,
      avg_watts: row.avg_watts as number | null,
      fps_per_watt: row.fps_per_watt as number | null,
      avg_speed: row.avg_speed as number | null,
    });
  }

  // Sort by test order within each model
  for (const model of modelMap.values()) {
    model.by_test = sortTestNames(model.by_test.map(t => t.test_name))
      .map(testName => model.by_test.find(t => t.test_name === testName)!)
      .filter(Boolean);
  }

  return c.json({
    success: true,
    architectures: archMetadata.rows.map((row: Record<string, unknown>) => ({
      architecture: row.architecture,
      codename: row.codename,
      release_year: row.release_year,
      igpu_name: row.igpu_name,
      igpu_codename: row.igpu_codename,
      process_nm: row.process_nm,
      tdp_range: row.tdp_range,
      die_layout: row.die_layout,
      gpu_eu_count: row.gpu_eu_count,
      codec_support: {
        h264_encode: !!row.h264_encode,
        hevc_8bit_encode: !!row.hevc_8bit_encode,
        hevc_10bit_encode: !!row.hevc_10bit_encode,
        vp9_encode: !!row.vp9_encode,
        av1_encode: !!row.av1_encode,
      },
    })),
    models: Array.from(modelMap.values()).sort((a, b) => {
      // Sort by architecture first, then by model name
      if (a.architecture !== b.architecture) {
        return a.architecture.localeCompare(b.architecture);
      }
      return a.model_name.localeCompare(b.model_name);
    }),
    all_tests: sortTestNames(Array.from(new Set(modelsResult.rows.map((r: Record<string, unknown>) => r.test_name as string)))),
  });
});

export default results;
