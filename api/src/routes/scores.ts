/**
 * GET /api/scores
 * Calculate CPU scores based on performance, efficiency, and codec support.
 *
 * Scoring Methodology:
 * - Performance (40%): Percentile rank of avg_fps within each test type
 * - Efficiency (35%): Percentile rank of fps_per_watt within each test type
 * - Codec Support (25%): Percentage of test types the CPU has completed
 *
 * Final score = (performance * 0.40) + (efficiency * 0.35) + (codec * 0.25)
 * Score ranges from 0-100
 */

import { Hono } from 'hono';
import { getDb, Env } from '../lib/db';
import { withCache, CACHE_TTL } from '../lib/cache';

const scores = new Hono<{ Bindings: Env }>();

// Calculate percentile rank (0-100) for a value within an array
function percentileRank(value: number, sortedArray: number[]): number {
  if (sortedArray.length === 0) return 0;
  if (sortedArray.length === 1) return 100;

  let below = 0;
  for (const v of sortedArray) {
    if (v < value) below++;
  }
  return Math.round((below / (sortedArray.length - 1)) * 100);
}

// Get all test types that exist in the database
async function getAllTestTypes(db: ReturnType<typeof getDb>, vendor: string): Promise<string[]> {
  const result = await db.execute({
    sql: `SELECT DISTINCT test_name FROM benchmark_results WHERE vendor = ? ORDER BY test_name`,
    args: [vendor],
  });
  return result.rows.map(r => r.test_name as string);
}

interface CpuTestData {
  test_name: string;
  avg_fps: number;
  fps_per_watt: number | null;
}

interface CpuData {
  cpu_raw: string;
  architecture: string | null;
  cpu_generation: number | null;
  tests: CpuTestData[];
}

// Get scores for all CPUs (SEMI_STATIC - 15min cache)
scores.get('/', async (c) => {
  return withCache(c.req.raw, CACHE_TTL.SEMI_STATIC, async () => {
    const db = getDb(c.env);
    const vendor = c.req.query('vendor') || 'intel';
    const cpuFilter = c.req.query('cpu'); // Optional: filter to specific CPU(s)

    // Get all test types for codec support calculation
    const allTestTypes = await getAllTestTypes(db, vendor);
    const totalTestTypes = allTestTypes.length;

    if (totalTestTypes === 0) {
      return { success: true, scores: [], methodology: getMethodology() };
    }

  // Build CPU filter condition
  const cpuConditions: string[] = ['vendor = ?'];
  const cpuArgs: (string | number)[] = [vendor];

  if (cpuFilter) {
    const cpus = cpuFilter.split('||').map(c => c.trim()).filter(c => c);
    if (cpus.length > 0) {
      cpuConditions.push(`cpu_raw IN (${cpus.map(() => '?').join(',')})`);
      cpuArgs.push(...cpus);
    }
  }

  // Get all benchmark results grouped by CPU
  const resultsQuery = await db.execute({
    sql: `
      SELECT
        cpu_raw,
        architecture,
        cpu_generation,
        test_name,
        AVG(avg_fps) as avg_fps,
        AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END) as avg_fps_per_watt
      FROM benchmark_results
      WHERE ${cpuConditions.join(' AND ')}
      GROUP BY cpu_raw, test_name
      ORDER BY cpu_raw, test_name
    `,
    args: cpuArgs,
  });

  // Build CPU data structure
  const cpuMap: Map<string, CpuData> = new Map();

  for (const row of resultsQuery.rows) {
    const cpuRaw = row.cpu_raw as string;

    if (!cpuMap.has(cpuRaw)) {
      cpuMap.set(cpuRaw, {
        cpu_raw: cpuRaw,
        architecture: row.architecture as string | null,
        cpu_generation: row.cpu_generation as number | null,
        tests: [],
      });
    }

    cpuMap.get(cpuRaw)!.tests.push({
      test_name: row.test_name as string,
      avg_fps: (row.avg_fps as number) || 0,
      fps_per_watt: row.avg_fps_per_watt as number | null,
    });
  }

  // Get all FPS and efficiency values per test type for percentile calculation
  const fpsPerTestType: Map<string, number[]> = new Map();
  const efficiencyPerTestType: Map<string, number[]> = new Map();

  for (const cpu of cpuMap.values()) {
    for (const test of cpu.tests) {
      if (!fpsPerTestType.has(test.test_name)) {
        fpsPerTestType.set(test.test_name, []);
        efficiencyPerTestType.set(test.test_name, []);
      }
      fpsPerTestType.get(test.test_name)!.push(test.avg_fps);
      if (test.fps_per_watt !== null && test.fps_per_watt > 0) {
        efficiencyPerTestType.get(test.test_name)!.push(test.fps_per_watt);
      }
    }
  }

  // Sort arrays for percentile calculation
  for (const [testName, values] of fpsPerTestType) {
    fpsPerTestType.set(testName, values.sort((a, b) => a - b));
  }
  for (const [testName, values] of efficiencyPerTestType) {
    efficiencyPerTestType.set(testName, values.sort((a, b) => a - b));
  }

  // Calculate scores for each CPU
  const cpuScores = [];

  for (const cpu of cpuMap.values()) {
    // Calculate performance percentile (average across all tests)
    let totalPerformancePercentile = 0;
    let performanceTestCount = 0;

    // Calculate efficiency percentile (average across tests with efficiency data)
    let totalEfficiencyPercentile = 0;
    let efficiencyTestCount = 0;

    const testScores: Record<string, { fps_percentile: number; efficiency_percentile: number | null }> = {};

    for (const test of cpu.tests) {
      const fpsArray = fpsPerTestType.get(test.test_name) || [];
      const fpsPercentile = percentileRank(test.avg_fps, fpsArray);

      totalPerformancePercentile += fpsPercentile;
      performanceTestCount++;

      let efficiencyPercentile: number | null = null;
      if (test.fps_per_watt !== null && test.fps_per_watt > 0) {
        const effArray = efficiencyPerTestType.get(test.test_name) || [];
        efficiencyPercentile = percentileRank(test.fps_per_watt, effArray);
        totalEfficiencyPercentile += efficiencyPercentile;
        efficiencyTestCount++;
      }

      testScores[test.test_name] = {
        fps_percentile: fpsPercentile,
        efficiency_percentile: efficiencyPercentile,
      };
    }

    // Calculate component scores
    const performanceScore = performanceTestCount > 0
      ? totalPerformancePercentile / performanceTestCount
      : 0;

    const efficiencyScore = efficiencyTestCount > 0
      ? totalEfficiencyPercentile / efficiencyTestCount
      : 50; // Default to median if no efficiency data

    const codecSupportScore = (cpu.tests.length / totalTestTypes) * 100;

    // Calculate final weighted score
    const finalScore = Math.round(
      (performanceScore * 0.40) +
      (efficiencyScore * 0.35) +
      (codecSupportScore * 0.25)
    );

    cpuScores.push({
      cpu_raw: cpu.cpu_raw,
      architecture: cpu.architecture,
      cpu_generation: cpu.cpu_generation,
      score: finalScore,
      components: {
        performance: Math.round(performanceScore),
        efficiency: Math.round(efficiencyScore),
        codec_support: Math.round(codecSupportScore),
      },
      tests_completed: cpu.tests.length,
      total_tests: totalTestTypes,
      test_scores: testScores,
    });
  }

    // Sort by score descending
    cpuScores.sort((a, b) => b.score - a.score);

    return {
      success: true,
      total_cpus: cpuScores.length,
      total_test_types: totalTestTypes,
      scores: cpuScores,
      methodology: getMethodology(),
    };
  });
});

// Get score for results - lookup map (SEMI_STATIC - 15min cache)
scores.get('/for-results', async (c) => {
  return withCache(c.req.raw, CACHE_TTL.SEMI_STATIC, async () => {
    const db = getDb(c.env);
    const vendor = c.req.query('vendor') || 'intel';

    // Get all test types for codec support calculation
    const allTestTypes = await getAllTestTypes(db, vendor);
    const totalTestTypes = allTestTypes.length;

    if (totalTestTypes === 0) {
      return { success: true, scores: {} };
    }

  // Get aggregated data per CPU
  const resultsQuery = await db.execute({
    sql: `
      SELECT
        cpu_raw,
        test_name,
        AVG(avg_fps) as avg_fps,
        AVG(CASE WHEN fps_per_watt > 0 THEN fps_per_watt ELSE NULL END) as avg_fps_per_watt
      FROM benchmark_results
      WHERE vendor = ?
      GROUP BY cpu_raw, test_name
    `,
    args: [vendor],
  });

  // Build data structures
  const cpuTests: Map<string, Map<string, { avg_fps: number; fps_per_watt: number | null }>> = new Map();
  const fpsPerTestType: Map<string, number[]> = new Map();
  const efficiencyPerTestType: Map<string, number[]> = new Map();

  for (const row of resultsQuery.rows) {
    const cpuRaw = row.cpu_raw as string;
    const testName = row.test_name as string;
    const avgFps = (row.avg_fps as number) || 0;
    const fpsPerWatt = row.avg_fps_per_watt as number | null;

    if (!cpuTests.has(cpuRaw)) {
      cpuTests.set(cpuRaw, new Map());
    }
    cpuTests.get(cpuRaw)!.set(testName, { avg_fps: avgFps, fps_per_watt: fpsPerWatt });

    if (!fpsPerTestType.has(testName)) {
      fpsPerTestType.set(testName, []);
      efficiencyPerTestType.set(testName, []);
    }
    fpsPerTestType.get(testName)!.push(avgFps);
    if (fpsPerWatt !== null && fpsPerWatt > 0) {
      efficiencyPerTestType.get(testName)!.push(fpsPerWatt);
    }
  }

  // Sort arrays for percentile calculation
  for (const [testName, values] of fpsPerTestType) {
    fpsPerTestType.set(testName, values.sort((a, b) => a - b));
  }
  for (const [testName, values] of efficiencyPerTestType) {
    efficiencyPerTestType.set(testName, values.sort((a, b) => a - b));
  }

  // Calculate scores for each CPU
  const scores: Record<string, number> = {};

  for (const [cpuRaw, tests] of cpuTests) {
    let totalPerformancePercentile = 0;
    let performanceTestCount = 0;
    let totalEfficiencyPercentile = 0;
    let efficiencyTestCount = 0;

    for (const [testName, data] of tests) {
      const fpsArray = fpsPerTestType.get(testName) || [];
      totalPerformancePercentile += percentileRank(data.avg_fps, fpsArray);
      performanceTestCount++;

      if (data.fps_per_watt !== null && data.fps_per_watt > 0) {
        const effArray = efficiencyPerTestType.get(testName) || [];
        totalEfficiencyPercentile += percentileRank(data.fps_per_watt, effArray);
        efficiencyTestCount++;
      }
    }

    const performanceScore = performanceTestCount > 0
      ? totalPerformancePercentile / performanceTestCount
      : 0;

    const efficiencyScore = efficiencyTestCount > 0
      ? totalEfficiencyPercentile / efficiencyTestCount
      : 50;

    const codecSupportScore = (tests.size / totalTestTypes) * 100;

      scores[cpuRaw] = Math.round(
        (performanceScore * 0.40) +
        (efficiencyScore * 0.35) +
        (codecSupportScore * 0.25)
      );
    }

    return {
      success: true,
      scores,
    };
  });
});

function getMethodology() {
  return {
    description: "CPU scores are calculated using a weighted combination of performance, efficiency, and codec support.",
    weights: {
      performance: {
        weight: 0.40,
        description: "Percentile rank of average FPS compared to all CPUs for each test type"
      },
      efficiency: {
        weight: 0.35,
        description: "Percentile rank of FPS per watt compared to all CPUs for each test type"
      },
      codec_support: {
        weight: 0.25,
        description: "Percentage of available test types that the CPU has completed"
      }
    },
    formula: "Score = (Performance × 0.40) + (Efficiency × 0.35) + (Codec Support × 0.25)",
    interpretation: {
      "90-100": "Excellent - Top tier performance and efficiency",
      "70-89": "Good - Above average across most metrics",
      "50-69": "Average - Typical performance for its generation",
      "30-49": "Below Average - Limited in some areas",
      "0-29": "Limited - Older or constrained hardware"
    }
  };
}

export default scores;
