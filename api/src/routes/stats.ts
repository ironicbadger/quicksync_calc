/**
 * GET /api/stats
 * Aggregated statistics for charts.
 */

import { Hono } from 'hono';
import { getDb, Env } from '../lib/db';

const stats = new Hono<{ Bindings: Env }>();

// Get aggregated stats by architecture and test type
stats.get('/', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';
  const groupBy = c.req.query('group_by') || 'architecture'; // architecture or cpu_generation
  const testFilter = c.req.query('test');

  // Validate group_by
  const allowedGroupBy = ['architecture', 'cpu_generation'];
  const groupColumn = allowedGroupBy.includes(groupBy) ? groupBy : 'architecture';

  let testCondition = '';
  const args: (string | number)[] = [vendor];

  if (testFilter) {
    const tests = testFilter.split(',').map(t => t.trim()).filter(t => t);
    if (tests.length > 0) {
      testCondition = ` AND test_name IN (${tests.map(() => '?').join(',')})`;
      args.push(...tests);
    }
  }

  const result = await db.execute({
    sql: `
      SELECT
        ${groupColumn},
        test_name,
        COUNT(*) as count,
        AVG(avg_fps) as avg_fps_mean,
        MIN(avg_fps) as avg_fps_min,
        MAX(avg_fps) as avg_fps_max,
        AVG(avg_watts) as avg_watts_mean,
        MIN(avg_watts) as avg_watts_min,
        MAX(avg_watts) as avg_watts_max,
        AVG(fps_per_watt) as efficiency_mean,
        MIN(fps_per_watt) as efficiency_min,
        MAX(fps_per_watt) as efficiency_max
      FROM benchmark_results
      WHERE vendor = ?
        AND ${groupColumn} IS NOT NULL
        AND avg_watts IS NOT NULL
        AND avg_watts > 0
        AND avg_watts < 50
        ${testCondition}
      GROUP BY ${groupColumn}, test_name
      ORDER BY ${groupColumn}, test_name
    `,
    args,
  });

  return c.json({
    success: true,
    group_by: groupColumn,
    stats: result.rows,
  });
});

// Get boxplot data (quartiles) for each group
stats.get('/boxplot', async (c) => {
  const db = getDb(c.env);
  const vendor = c.req.query('vendor') || 'intel';
  const metric = c.req.query('metric') || 'avg_fps'; // avg_fps, avg_watts, fps_per_watt
  const groupBy = c.req.query('group_by') || 'cpu_generation';
  const testFilter = c.req.query('test');

  // Validate inputs
  const allowedMetrics = ['avg_fps', 'avg_watts', 'fps_per_watt'];
  const metricColumn = allowedMetrics.includes(metric) ? metric : 'avg_fps';

  const allowedGroupBy = ['architecture', 'cpu_generation'];
  const groupColumn = allowedGroupBy.includes(groupBy) ? groupBy : 'cpu_generation';

  // Build query
  let testCondition = '';
  const args: (string | number)[] = [vendor];

  if (testFilter) {
    const tests = testFilter.split(',').map(t => t.trim()).filter(t => t);
    if (tests.length > 0) {
      testCondition = ` AND test_name IN (${tests.map(() => '?').join(',')})`;
      args.push(...tests);
    }
  }

  // Get all values grouped by category and test
  const result = await db.execute({
    sql: `
      SELECT
        ${groupColumn} as group_key,
        test_name,
        ${metricColumn} as value
      FROM benchmark_results
      WHERE vendor = ?
        AND ${groupColumn} IS NOT NULL
        AND ${metricColumn} IS NOT NULL
        ${metricColumn === 'avg_watts' ? 'AND avg_watts > 0 AND avg_watts < 50' : ''}
        ${metricColumn === 'fps_per_watt' ? 'AND fps_per_watt IS NOT NULL' : ''}
        ${testCondition}
      ORDER BY ${groupColumn}, test_name, ${metricColumn}
    `,
    args,
  });

  // Group values for boxplot calculation
  const grouped: Record<string, Record<string, number[]>> = {};

  for (const row of result.rows) {
    const groupKey = String(row.group_key);
    const testName = String(row.test_name);
    const value = row.value as number;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {};
    }
    if (!grouped[groupKey][testName]) {
      grouped[groupKey][testName] = [];
    }
    grouped[groupKey][testName].push(value);
  }

  // Calculate quartiles for each group
  const boxplotData: Array<{
    group: string;
    test: string;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    count: number;
  }> = [];

  for (const [groupKey, tests] of Object.entries(grouped)) {
    for (const [testName, values] of Object.entries(tests)) {
      if (values.length < 1) continue; // Need at least 1 value

      values.sort((a, b) => a - b);
      const n = values.length;

      const q1Idx = Math.floor(n * 0.25);
      const medIdx = Math.floor(n * 0.5);
      const q3Idx = Math.floor(n * 0.75);

      boxplotData.push({
        group: groupKey,
        test: testName,
        min: values[0],
        q1: values[q1Idx],
        median: values[medIdx],
        q3: values[q3Idx],
        max: values[n - 1],
        count: n,
      });
    }
  }

  // Sort by group (numerical if generations)
  if (groupColumn === 'cpu_generation') {
    boxplotData.sort((a, b) => parseInt(a.group) - parseInt(b.group));
  } else {
    boxplotData.sort((a, b) => a.group.localeCompare(b.group));
  }

  return c.json({
    success: true,
    metric: metricColumn,
    group_by: groupColumn,
    boxplot: boxplotData,
  });
});

// Get summary stats for the homepage
stats.get('/summary', async (c) => {
  const db = getDb(c.env);

  const result = await db.execute({
    sql: `
      SELECT
        COUNT(*) as total_results,
        COUNT(DISTINCT cpu_raw) as unique_cpus,
        COUNT(DISTINCT submitter_id) as unique_submitters,
        COUNT(DISTINCT architecture) as architectures_count
      FROM benchmark_results
    `,
    args: [],
  });

  const row = result.rows[0];

  return c.json({
    success: true,
    summary: {
      total_results: row.total_results,
      unique_cpus: row.unique_cpus,
      unique_submitters: row.unique_submitters,
      architectures_count: row.architectures_count,
    },
  });
});

export default stats;
