/**
 * Client-side data loader and filtering utilities.
 * Replaces API calls with local JSON data operations.
 */

// Types matching the R2 JSON structure
export interface BenchmarkResult {
  id: number;
  submitted_at: string;
  submitter_id: string | null;
  cpu_raw: string;
  cpu_brand: string | null;
  cpu_model: string | null;
  cpu_generation: number | null;
  architecture: string | null;
  test_name: string;
  test_file: string;
  bitrate_kbps: number;
  time_seconds: number;
  avg_fps: number;
  avg_speed: number | null;
  avg_watts: number | null;
  fps_per_watt: number | null;
  result_hash: string;
  vendor: string;
  // Quality metrics (optional, from --vmaf flag)
  ssim?: number;
  psnr?: number;
}

export interface CpuArchitecture {
  id: number;
  pattern: string;
  architecture: string;
  codename: string | null;
  release_year: number;
  release_quarter: number | null;
  sort_order: number;
  h264_encode: boolean;
  hevc_8bit_encode: boolean;
  hevc_10bit_encode: boolean;
  vp9_encode: boolean;
  av1_encode: boolean;
  igpu_name: string | null;
  igpu_codename: string | null;
  process_nm: string | null;
  max_p_cores: number | null;
  max_e_cores: number | null;
  tdp_range: string | null;
  die_layout: string | null;
  gpu_eu_count: string | null;
  vendor: string;
}

export interface ConcurrencyResult {
  id: number;
  submitted_at: string;
  submitter_id: string | null;
  cpu_raw: string;
  cpu_brand: string | null;
  cpu_model: string | null;
  cpu_generation: number | null;
  architecture: string | null;
  test_name: string;
  test_file: string;
  speeds_json: number[];
  max_concurrency: number;
  result_hash: string;
  vendor: string;
}

export interface BenchmarkData {
  version: number;
  lastUpdated: string;
  meta: {
    totalResults: number;
    uniqueCpus: number;
    architecturesCount: number;
    uniqueTests: number;
  };
  architectures: CpuArchitecture[];
  results: BenchmarkResult[];
  concurrencyResults: ConcurrencyResult[];
  cpuFeatures: Record<string, { ecc_support: boolean }>;
}

export interface Filters {
  generation: string[];
  architecture: string[];
  test: string[];
  cpu: string[];
  submitter: string[];
  ecc: string[];
}

// Global data cache
let cachedData: BenchmarkData | null = null;
let loadPromise: Promise<BenchmarkData> | null = null;

// Data URL - R2 public bucket
const DATA_URL = 'https://pub-c66d7559b64a430ca682a4bd624f04d8.r2.dev/benchmarks.json';

/**
 * Load benchmark data from R2.
 */
export async function loadData(): Promise<BenchmarkData> {
  if (cachedData) return cachedData;
  if (loadPromise) return loadPromise;

  loadPromise = fetch(DATA_URL)
    .then(r => {
      if (!r.ok) throw new Error(`Failed to load data: ${r.status}`);
      return r.json();
    })
    .then((data: BenchmarkData) => {
      cachedData = data;
      return data;
    });

  return loadPromise;
}

/**
 * Get summary stats (replaces /api/stats/summary)
 */
export function getSummary(data: BenchmarkData) {
  return {
    success: true,
    summary: {
      total_results: data.meta.totalResults,
      unique_cpus: data.meta.uniqueCpus,
      architectures_count: data.meta.architecturesCount,
    }
  };
}

/**
 * Get filter options (replaces /api/results/filters)
 */
export function getFilters(data: BenchmarkData) {
  const generations = new Set<string>();
  const architectures = new Set<string>();
  const tests = new Set<string>();

  for (const r of data.results) {
    if (r.cpu_generation !== null) {
      generations.add(String(r.cpu_generation));
    }
    // Map certain architectures to virtual generations
    if (r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake') {
      generations.add('ultra-1');
    }
    if (r.architecture === 'Arrow Lake') {
      generations.add('ultra-2');
    }
    if (r.architecture === 'Alchemist' || r.architecture === 'Battlemage') {
      generations.add('arc');
    }
    if (r.architecture) architectures.add(r.architecture);
    if (r.test_name) tests.add(r.test_name);
  }

  return {
    success: true,
    filters: {
      generations: Array.from(generations),
      architectures: Array.from(architectures),
      tests: Array.from(tests),
    }
  };
}

/**
 * Filter results based on current filter state
 */
export function filterResults(data: BenchmarkData, filters: Filters): BenchmarkResult[] {
  return data.results.filter(r => {
    // Generation filter (including virtual generations)
    if (filters.generation.length > 0) {
      const gen = String(r.cpu_generation);
      const isUltra1 = r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake';
      const isUltra2 = r.architecture === 'Arrow Lake';
      const isArc = r.architecture === 'Alchemist' || r.architecture === 'Battlemage';

      const matchesGen = filters.generation.includes(gen);
      const matchesUltra1 = filters.generation.includes('ultra-1') && isUltra1;
      const matchesUltra2 = filters.generation.includes('ultra-2') && isUltra2;
      const matchesArc = filters.generation.includes('arc') && isArc;

      if (!matchesGen && !matchesUltra1 && !matchesUltra2 && !matchesArc) {
        return false;
      }
    }

    // Architecture filter
    if (filters.architecture.length > 0 && r.architecture) {
      if (!filters.architecture.includes(r.architecture)) return false;
    }

    // Test filter
    if (filters.test.length > 0) {
      if (!filters.test.includes(r.test_name)) return false;
    }

    // CPU filter
    if (filters.cpu.length > 0) {
      if (!filters.cpu.includes(r.cpu_raw)) return false;
    }

    // Submitter filter
    if (filters.submitter.length > 0) {
      if (!r.submitter_id || !filters.submitter.includes(r.submitter_id)) return false;
    }

    // ECC filter
    if (filters.ecc.length > 0) {
      const hasEcc = data.cpuFeatures[r.cpu_raw]?.ecc_support ?? false;
      if (filters.ecc.includes('yes') && !hasEcc) return false;
      if (filters.ecc.includes('no') && hasEcc) return false;
    }

    return true;
  });
}

/**
 * Get filter counts (replaces /api/results/filter-counts)
 */
export function getFilterCounts(data: BenchmarkData, filters: Filters) {
  const filtered = filterResults(data, filters);

  const generations: Record<string, number> = {};
  const architectures: Record<string, number> = {};
  const tests: Record<string, number> = {};
  const cpus: Record<string, number> = {};
  const submitters: Record<string, number> = {};
  let eccYes = 0;
  let eccNo = 0;

  for (const r of filtered) {
    // Generations
    if (r.cpu_generation !== null) {
      const gen = String(r.cpu_generation);
      generations[gen] = (generations[gen] || 0) + 1;
    }

    // Virtual generations
    if (r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake') {
      generations['ultra-1'] = (generations['ultra-1'] || 0) + 1;
    }
    if (r.architecture === 'Arrow Lake') {
      generations['ultra-2'] = (generations['ultra-2'] || 0) + 1;
    }
    if (r.architecture === 'Alchemist' || r.architecture === 'Battlemage') {
      generations['arc'] = (generations['arc'] || 0) + 1;
    }

    // Architectures
    if (r.architecture) {
      architectures[r.architecture] = (architectures[r.architecture] || 0) + 1;
    }

    // Tests
    tests[r.test_name] = (tests[r.test_name] || 0) + 1;

    // CPUs
    cpus[r.cpu_raw] = (cpus[r.cpu_raw] || 0) + 1;

    // Submitters
    if (r.submitter_id) {
      submitters[r.submitter_id] = (submitters[r.submitter_id] || 0) + 1;
    }

    // ECC
    const hasEcc = data.cpuFeatures[r.cpu_raw]?.ecc_support ?? false;
    if (hasEcc) eccYes++;
    else eccNo++;
  }

  return {
    success: true,
    counts: {
      generations,
      architectures,
      tests,
      cpus,
      submitters,
      ecc: { yes: eccYes, no: eccNo },
    }
  };
}

/**
 * Get paginated results (replaces /api/results)
 */
export function getResults(
  data: BenchmarkData,
  filters: Filters,
  options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const { limit = 100, offset = 0, sortBy = 'submitted_at', sortOrder = 'desc' } = options;

  let filtered = filterResults(data, filters);

  // Sort
  filtered = [...filtered].sort((a, b) => {
    let aVal = (a as any)[sortBy];
    let bVal = (b as any)[sortBy];

    // Handle nulls
    if (aVal === null) aVal = sortOrder === 'asc' ? Infinity : -Infinity;
    if (bVal === null) bVal = sortOrder === 'asc' ? Infinity : -Infinity;

    // Compare
    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // Paginate
  const paginated = filtered.slice(offset, offset + limit);

  return {
    success: true,
    total: filtered.length,
    results: paginated,
  };
}

/**
 * Compute boxplot data (replaces /api/stats/boxplot)
 */
export function getBoxplotData(
  data: BenchmarkData,
  filters: Filters,
  metric: 'avg_fps' | 'avg_watts' | 'fps_per_watt',
  groupBy: 'cpu_generation' | 'architecture'
) {
  const filtered = filterResults(data, filters);

  // Group by the specified field
  const groups: Record<string, number[]> = {};

  for (const r of filtered) {
    const value = r[metric];
    if (value === null) continue;

    let groupKey: string;
    if (groupBy === 'cpu_generation') {
      if (r.cpu_generation === null) continue;
      groupKey = String(r.cpu_generation);
    } else {
      if (!r.architecture) continue;
      groupKey = r.architecture;
    }

    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(value);
  }

  // Compute quartiles for each group
  const boxplotData = Object.entries(groups).map(([group, values]) => {
    values.sort((a, b) => a - b);
    const n = values.length;

    return {
      group,
      min: values[0],
      q1: percentile(values, 25),
      median: percentile(values, 50),
      q3: percentile(values, 75),
      max: values[n - 1],
      count: n,
    };
  });

  return {
    success: true,
    metric,
    group_by: groupBy,
    data: boxplotData,
  };
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (idx - lower) * (sorted[upper] - sorted[lower]);
}

/**
 * Get generation stats (replaces /api/results/generation-stats)
 */
export function getGenerationStats(data: BenchmarkData, filters: Filters, generations: string[]) {
  const filtered = filterResults(data, {
    ...filters,
    generation: generations,
  });

  // Group by generation and test
  const byGen: Record<string, Record<string, BenchmarkResult[]>> = {};

  for (const r of filtered) {
    let gen: string;
    if (r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake') {
      gen = 'ultra-1';
    } else if (r.architecture === 'Arrow Lake') {
      gen = 'ultra-2';
    } else if (r.architecture === 'Alchemist' || r.architecture === 'Battlemage') {
      gen = 'arc';
    } else {
      gen = String(r.cpu_generation);
    }

    if (!generations.includes(gen)) continue;

    if (!byGen[gen]) byGen[gen] = {};
    if (!byGen[gen][r.test_name]) byGen[gen][r.test_name] = [];
    byGen[gen][r.test_name].push(r);
  }

  // Compute stats
  const stats = Object.entries(byGen).map(([gen, byTest]) => {
    const overall = Object.values(byTest).flat();
    const by_test = Object.entries(byTest).map(([test, results]) => ({
      test_name: test,
      count: results.length,
      avg_fps: avg(results.map(r => r.avg_fps)),
      min_fps: Math.min(...results.map(r => r.avg_fps)),
      max_fps: Math.max(...results.map(r => r.avg_fps)),
      avg_watts: avg(results.filter(r => r.avg_watts !== null).map(r => r.avg_watts!)),
      avg_efficiency: avg(results.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!)),
    }));

    return {
      generation: gen,
      overall: {
        count: overall.length,
        avg_fps: avg(overall.map(r => r.avg_fps)),
        avg_watts: avg(overall.filter(r => r.avg_watts !== null).map(r => r.avg_watts!)),
        avg_efficiency: avg(overall.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!)),
      },
      by_test,
    };
  });

  // Baseline comparison (8th gen)
  const baseline = data.results.filter(r => r.cpu_generation === 8);
  const baselineAvgFps = avg(baseline.map(r => r.avg_fps));
  const baselineAvgWatts = avg(baseline.filter(r => r.avg_watts !== null).map(r => r.avg_watts!));
  const baselineEfficiency = avg(baseline.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!));

  return {
    success: true,
    stats,
    baseline: {
      generation: '8',
      avg_fps: baselineAvgFps,
      avg_watts: baselineAvgWatts,
      avg_efficiency: baselineEfficiency,
    },
  };
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Get CPU stats (replaces /api/results/cpu-stats)
 */
export function getCpuStats(data: BenchmarkData, cpus: string[]) {
  const filtered = data.results.filter(r => cpus.includes(r.cpu_raw));

  // Group by CPU and test
  const byCpu: Record<string, Record<string, BenchmarkResult[]>> = {};

  for (const r of filtered) {
    if (!byCpu[r.cpu_raw]) byCpu[r.cpu_raw] = {};
    if (!byCpu[r.cpu_raw][r.test_name]) byCpu[r.cpu_raw][r.test_name] = [];
    byCpu[r.cpu_raw][r.test_name].push(r);
  }

  const stats = Object.entries(byCpu).map(([cpu, byTest]) => {
    const overall = Object.values(byTest).flat();
    const by_test = Object.entries(byTest).map(([test, results]) => ({
      test_name: test,
      count: results.length,
      avg_fps: avg(results.map(r => r.avg_fps)),
      min_fps: Math.min(...results.map(r => r.avg_fps)),
      max_fps: Math.max(...results.map(r => r.avg_fps)),
      avg_watts: avg(results.filter(r => r.avg_watts !== null).map(r => r.avg_watts!)),
      avg_efficiency: avg(results.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!)),
    }));

    const firstResult = overall[0];
    return {
      cpu_raw: cpu,
      architecture: firstResult?.architecture,
      cpu_generation: firstResult?.cpu_generation,
      overall: {
        count: overall.length,
        avg_fps: avg(overall.map(r => r.avg_fps)),
        avg_watts: avg(overall.filter(r => r.avg_watts !== null).map(r => r.avg_watts!)),
        avg_efficiency: avg(overall.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!)),
      },
      by_test,
    };
  });

  return {
    success: true,
    stats,
  };
}

/**
 * Get CPU scores (replaces /api/scores/for-results)
 * Simplified scoring: 40% performance + 35% efficiency + 25% codec support
 */
export function getCpuScores(data: BenchmarkData) {
  // Group results by CPU
  const byCpu: Record<string, BenchmarkResult[]> = {};
  for (const r of data.results) {
    if (!byCpu[r.cpu_raw]) byCpu[r.cpu_raw] = [];
    byCpu[r.cpu_raw].push(r);
  }

  // Get max values for normalization
  const allFps = data.results.map(r => r.avg_fps);
  const allEfficiency = data.results.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!);
  const maxFps = Math.max(...allFps);
  const maxEfficiency = Math.max(...allEfficiency);

  // Get architecture codec support lookup
  const archCodecs: Record<string, { av1: boolean; hevc10: boolean; vp9: boolean }> = {};
  for (const arch of data.architectures) {
    archCodecs[arch.architecture] = {
      av1: arch.av1_encode,
      hevc10: arch.hevc_10bit_encode,
      vp9: arch.vp9_encode,
    };
  }

  const scores: Record<string, number> = {};

  for (const [cpu, results] of Object.entries(byCpu)) {
    const avgFps = avg(results.map(r => r.avg_fps));
    const avgEfficiency = avg(results.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!));

    // Normalize to 0-100
    const fpsScore = (avgFps / maxFps) * 100;
    const efficiencyScore = maxEfficiency > 0 ? (avgEfficiency / maxEfficiency) * 100 : 0;

    // Codec support score (based on architecture)
    const arch = results[0]?.architecture;
    const codecs = arch ? archCodecs[arch] : null;
    let codecScore = 50; // Base score
    if (codecs) {
      if (codecs.av1) codecScore += 25;
      if (codecs.hevc10) codecScore += 15;
      if (codecs.vp9) codecScore += 10;
    }

    // Weighted average
    const score = Math.round(fpsScore * 0.4 + efficiencyScore * 0.35 + codecScore * 0.25);
    scores[cpu] = Math.min(100, Math.max(0, score));
  }

  return {
    success: true,
    scores,
  };
}

/**
 * Get leaderboard scores with full CPU info (replaces /api/scores)
 */
export function getLeaderboardScores(data: BenchmarkData) {
  // Group results by CPU
  const byCpu: Record<string, BenchmarkResult[]> = {};
  for (const r of data.results) {
    if (!byCpu[r.cpu_raw]) byCpu[r.cpu_raw] = [];
    byCpu[r.cpu_raw].push(r);
  }

  // Get all FPS and efficiency values for percentile calculation
  const cpuAvgFps: { cpu: string; fps: number }[] = [];
  const cpuAvgEfficiency: { cpu: string; eff: number }[] = [];

  for (const [cpu, results] of Object.entries(byCpu)) {
    cpuAvgFps.push({ cpu, fps: avg(results.map(r => r.avg_fps)) });
    const effResults = results.filter(r => r.fps_per_watt !== null);
    if (effResults.length > 0) {
      cpuAvgEfficiency.push({ cpu, eff: avg(effResults.map(r => r.fps_per_watt!)) });
    }
  }

  // Sort for percentile ranking
  cpuAvgFps.sort((a, b) => a.fps - b.fps);
  cpuAvgEfficiency.sort((a, b) => a.eff - b.eff);

  // Create percentile lookup
  const fpsPercentile: Record<string, number> = {};
  cpuAvgFps.forEach((item, idx) => {
    fpsPercentile[item.cpu] = Math.round((idx / (cpuAvgFps.length - 1)) * 100);
  });

  const effPercentile: Record<string, number> = {};
  cpuAvgEfficiency.forEach((item, idx) => {
    effPercentile[item.cpu] = Math.round((idx / (cpuAvgEfficiency.length - 1)) * 100);
  });

  // Get total test types
  const allTests = new Set(data.results.map(r => r.test_name));
  const totalTests = allTests.size;

  // Get architecture codec support lookup
  const archCodecs: Record<string, { av1: boolean; hevc10: boolean; vp9: boolean }> = {};
  for (const arch of data.architectures) {
    archCodecs[arch.architecture] = {
      av1: arch.av1_encode,
      hevc10: arch.hevc_10bit_encode,
      vp9: arch.vp9_encode,
    };
  }

  const scores: Array<{
    cpu_raw: string;
    architecture: string | null;
    cpu_generation: number | null;
    score: number;
    components: { performance: number; efficiency: number; codec_support: number };
    tests_completed: number;
    total_tests: number;
  }> = [];

  for (const [cpu, results] of Object.entries(byCpu)) {
    const perfScore = fpsPercentile[cpu] ?? 50;
    const effScore = effPercentile[cpu] ?? 50;

    // Codec support score
    const arch = results[0]?.architecture;
    const codecs = arch ? archCodecs[arch] : null;
    let codecScore = 50;
    if (codecs) {
      if (codecs.av1) codecScore += 25;
      if (codecs.hevc10) codecScore += 15;
      if (codecs.vp9) codecScore += 10;
    }

    // Tests completed
    const testsCompleted = new Set(results.map(r => r.test_name)).size;

    // Weighted score
    const score = Math.round(perfScore * 0.4 + effScore * 0.35 + codecScore * 0.25);

    scores.push({
      cpu_raw: cpu,
      architecture: results[0]?.architecture ?? null,
      cpu_generation: results[0]?.cpu_generation ?? null,
      score: Math.min(100, Math.max(0, score)),
      components: {
        performance: perfScore,
        efficiency: effScore,
        codec_support: codecScore,
      },
      tests_completed: testsCompleted,
      total_tests: totalTests,
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return {
    success: true,
    total_cpus: scores.length,
    total_test_types: totalTests,
    scores,
  };
}

/**
 * Get generation detail data (replaces /api/results/generation-detail)
 */
export function getGenerationDetail(data: BenchmarkData, gen: string) {
  // Define generation info
  const generationInfo: Record<string, { display_name: string; architectures: string[] }> = {
    '6': { display_name: '6th Gen (Skylake)', architectures: ['Skylake'] },
    '7': { display_name: '7th Gen (Kaby Lake)', architectures: ['Kaby Lake'] },
    '8': { display_name: '8th Gen (Coffee Lake)', architectures: ['Coffee Lake', 'Coffee Lake Refresh'] },
    '9': { display_name: '9th Gen (Coffee Lake Refresh)', architectures: ['Coffee Lake Refresh'] },
    '10': { display_name: '10th Gen (Comet Lake)', architectures: ['Comet Lake', 'Ice Lake'] },
    '11': { display_name: '11th Gen (Rocket/Tiger Lake)', architectures: ['Rocket Lake', 'Tiger Lake'] },
    '12': { display_name: '12th Gen (Alder Lake)', architectures: ['Alder Lake', 'Alder Lake-N'] },
    '13': { display_name: '13th Gen (Raptor Lake)', architectures: ['Raptor Lake'] },
    '14': { display_name: '14th Gen (Raptor Lake Refresh)', architectures: ['Raptor Lake Refresh'] },
    'ultra-1': { display_name: 'Intel Core Ultra Series 1', architectures: ['Meteor Lake', 'Lunar Lake'] },
    'ultra-2': { display_name: 'Intel Core Ultra Series 2', architectures: ['Arrow Lake'] },
    'arc': { display_name: 'Intel Arc GPUs', architectures: ['Alchemist', 'Battlemage', 'Arc Alchemist'] },
  };

  const info = generationInfo[gen];
  if (!info) {
    return { success: false, error: 'Unknown generation' };
  }

  // Filter results for this generation
  const isNumericGen = /^\d+$/.test(gen);
  const genResults = data.results.filter(r => {
    if (isNumericGen) {
      return r.cpu_generation === parseInt(gen);
    }
    // Virtual generations
    if (gen === 'ultra-1') {
      return r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake';
    }
    if (gen === 'ultra-2') {
      return r.architecture === 'Arrow Lake';
    }
    if (gen === 'arc') {
      return r.architecture === 'Alchemist' || r.architecture === 'Battlemage' || r.architecture === 'Arc Alchemist';
    }
    return false;
  });

  // Get architecture info
  const archData = data.architectures.find(a => info.architectures.includes(a.architecture));

  // Get all architecture variants for this generation
  const archVariants = data.architectures.filter(a => info.architectures.includes(a.architecture));

  // Codec support from architecture
  const codecSupport = {
    h264_encode: archData?.h264_encode ?? true,
    hevc_8bit_encode: archData?.hevc_8bit_encode ?? false,
    hevc_10bit_encode: archData?.hevc_10bit_encode ?? false,
    vp9_encode: archData?.vp9_encode ?? false,
    av1_encode: archData?.av1_encode ?? false,
  };

  // Benchmark stats
  const uniqueCpus = new Set(genResults.map(r => r.cpu_raw));
  const uniqueSubmissions = new Set(genResults.map(r => `${r.submitted_at}|${r.cpu_raw}`)).size;
  const avgFps = avg(genResults.map(r => r.avg_fps));
  const avgWatts = avg(genResults.filter(r => r.avg_watts !== null).map(r => r.avg_watts!));
  const fpsPerWatt = avg(genResults.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!));

  // Stats by test
  const byTest: Record<string, BenchmarkResult[]> = {};
  for (const r of genResults) {
    if (!byTest[r.test_name]) byTest[r.test_name] = [];
    byTest[r.test_name].push(r);
  }

  const testStats = Object.entries(byTest).map(([test, results]) => ({
    test_name: test,
    count: results.length,
    avg_fps: avg(results.map(r => r.avg_fps)),
    min_fps: Math.min(...results.map(r => r.avg_fps)),
    max_fps: Math.max(...results.map(r => r.avg_fps)),
    avg_watts: avg(results.filter(r => r.avg_watts !== null).map(r => r.avg_watts!)),
    fps_per_watt: avg(results.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!)),
  }));

  // Baseline comparison (8th gen)
  const baseline8 = data.results.filter(r => r.cpu_generation === 8);
  const baselineFps = avg(baseline8.map(r => r.avg_fps));
  const baselineEfficiency = avg(baseline8.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!));

  const fpsDiff = baselineFps > 0 ? Math.round(((avgFps - baselineFps) / baselineFps) * 100) : null;
  const effDiff = baselineEfficiency > 0 ? Math.round(((fpsPerWatt - baselineEfficiency) / baselineEfficiency) * 100) : null;

  // Baseline by test for charts
  const baselineByTest = Object.entries(byTest).map(([test]) => {
    const baseResults = baseline8.filter(r => r.test_name === test);
    return {
      test_name: test,
      avg_fps: avg(baseResults.map(r => r.avg_fps)),
      avg_watts: avg(baseResults.filter(r => r.avg_watts !== null).map(r => r.avg_watts!)),
      fps_per_watt: avg(baseResults.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!)),
    };
  });

  // CPU models with stats
  const cpuStats: Record<string, { results: BenchmarkResult[]; fps: number; watts: number; efficiency: number }> = {};
  for (const r of genResults) {
    if (!cpuStats[r.cpu_raw]) {
      cpuStats[r.cpu_raw] = { results: [], fps: 0, watts: 0, efficiency: 0 };
    }
    cpuStats[r.cpu_raw].results.push(r);
  }

  const cpuModels = Object.entries(cpuStats).map(([cpu, stats]) => {
    const fps = avg(stats.results.map(r => r.avg_fps));
    const watts = avg(stats.results.filter(r => r.avg_watts !== null).map(r => r.avg_watts!));
    const efficiency = avg(stats.results.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!));

    // Count unique submissions (submitted_at + cpu_raw)
    const uniqueSubmissions = new Set(stats.results.map(r => r.submitted_at)).size;

    return {
      cpu_raw: cpu,
      result_count: uniqueSubmissions,
      avg_fps: fps,
      avg_watts: watts,
      fps_per_watt: efficiency,
    };
  });

  // Timeline navigation
  const allGens = ['6', '7', '8', '9', '10', '11', '12', '13', '14', 'ultra-1', 'ultra-2', 'arc'];
  const currentIdx = allGens.indexOf(gen);
  const prevGen = currentIdx > 0 ? allGens[currentIdx - 1] : null;
  const nextGen = currentIdx < allGens.length - 1 ? allGens[currentIdx + 1] : null;

  return {
    success: true,
    display_name: info.display_name,
    architecture: {
      name: archData?.architecture ?? info.architectures[0],
      codename: archData?.codename ?? null,
      release_year: archData?.release_year ?? null,
      igpu_name: archData?.igpu_name ?? null,
      gpu_eu_count: archData?.gpu_eu_count ?? null,
      process_nm: archData?.process_nm ?? null,
    },
    architecture_variants: archVariants.map(a => ({
      architecture: a.architecture,
      igpu_name: a.igpu_name,
      gpu_eu_count: a.gpu_eu_count,
    })),
    has_multiple_variants: archVariants.length > 1,
    codec_support: codecSupport,
    benchmark_stats: {
      total_results: uniqueSubmissions,
      unique_cpus: uniqueCpus.size,
      avg_fps: avgFps,
      avg_watts: avgWatts,
      fps_per_watt: fpsPerWatt,
      by_test: testStats,
    },
    baseline_comparison: {
      fps_diff_percent: fpsDiff,
      efficiency_diff_percent: effDiff,
    },
    baseline_by_test: baselineByTest,
    cpu_models: cpuModels,
    timeline: {
      previous: prevGen ? { identifier: prevGen, name: generationInfo[prevGen]?.display_name ?? prevGen } : null,
      next: nextGen ? { identifier: nextGen, name: generationInfo[nextGen]?.display_name ?? nextGen } : null,
      all_generations: allGens.map(g => ({
        identifier: g,
        name: generationInfo[g]?.display_name ?? g,
        is_current: g === gen,
      })),
    },
  };
}

/**
 * Get architecture stats (replaces /api/results/architecture-stats)
 */
export function getArchitectureStats(data: BenchmarkData, architectures: string[]) {
  const filtered = data.results.filter(r => r.architecture && architectures.includes(r.architecture));

  // Group by architecture and test
  const byArch: Record<string, Record<string, BenchmarkResult[]>> = {};

  for (const r of filtered) {
    if (!r.architecture) continue;
    if (!byArch[r.architecture]) byArch[r.architecture] = {};
    if (!byArch[r.architecture][r.test_name]) byArch[r.architecture][r.test_name] = [];
    byArch[r.architecture][r.test_name].push(r);
  }

  const stats = Object.entries(byArch).map(([arch, byTest]) => {
    const overall = Object.values(byTest).flat();
    const by_test = Object.entries(byTest).map(([test, results]) => ({
      test_name: test,
      count: results.length,
      avg_fps: avg(results.map(r => r.avg_fps)),
      min_fps: Math.min(...results.map(r => r.avg_fps)),
      max_fps: Math.max(...results.map(r => r.avg_fps)),
      avg_watts: avg(results.filter(r => r.avg_watts !== null).map(r => r.avg_watts!)),
      avg_efficiency: avg(results.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!)),
    }));

    return {
      architecture: arch,
      overall: {
        count: overall.length,
        avg_fps: avg(overall.map(r => r.avg_fps)),
        avg_watts: avg(overall.filter(r => r.avg_watts !== null).map(r => r.avg_watts!)),
        avg_efficiency: avg(overall.filter(r => r.fps_per_watt !== null).map(r => r.fps_per_watt!)),
      },
      by_test,
    };
  });

  return {
    success: true,
    stats,
  };
}

// ============================================================
// Concurrency Data Functions
// ============================================================

/**
 * Get concurrency results for a specific CPU
 */
export function getConcurrencyForCpu(data: BenchmarkData, cpuRaw: string): ConcurrencyResult[] {
  return data.concurrencyResults.filter(r => r.cpu_raw === cpuRaw);
}

/**
 * Get max concurrency by test for a CPU
 * Returns: { h264_1080p: 11, hevc_8bit: 6, av1_1080p: 3 }
 */
export function getMaxConcurrencyByCpu(data: BenchmarkData, cpuRaw: string): Record<string, number> {
  const results = getConcurrencyForCpu(data, cpuRaw);
  const maxByCpu: Record<string, number> = {};

  for (const r of results) {
    const current = maxByCpu[r.test_name] || 0;
    if (r.max_concurrency > current) {
      maxByCpu[r.test_name] = r.max_concurrency;
    }
  }

  return maxByCpu;
}

/**
 * Get concurrency summary for all CPUs
 * Returns array of { cpu_raw, architecture, h264_max, hevc_max, av1_max }
 */
export function getConcurrencySummary(data: BenchmarkData): Array<{
  cpu_raw: string;
  architecture: string | null;
  cpu_generation: number | null;
  h264_max: number | null;
  hevc_max: number | null;
  av1_max: number | null;
}> {
  // Group by CPU
  const byCpu: Record<string, ConcurrencyResult[]> = {};
  for (const r of data.concurrencyResults) {
    if (!byCpu[r.cpu_raw]) byCpu[r.cpu_raw] = [];
    byCpu[r.cpu_raw].push(r);
  }

  return Object.entries(byCpu).map(([cpu, results]) => {
    const h264 = results.find(r => r.test_name === 'h264_1080p');
    const hevc = results.find(r => r.test_name === 'hevc_8bit');
    const av1 = results.find(r => r.test_name === 'av1_1080p');

    return {
      cpu_raw: cpu,
      architecture: results[0]?.architecture ?? null,
      cpu_generation: results[0]?.cpu_generation ?? null,
      h264_max: h264?.max_concurrency ?? null,
      hevc_max: hevc?.max_concurrency ?? null,
      av1_max: av1?.max_concurrency ?? null,
    };
  });
}

/**
 * Get concurrency leaderboard (CPUs ranked by max concurrent streams)
 */
export function getConcurrencyLeaderboard(
  data: BenchmarkData,
  testName: string = 'h264_1080p'
): Array<{
  cpu_raw: string;
  architecture: string | null;
  cpu_generation: number | null;
  max_concurrency: number;
  speeds: number[];
}> {
  // Filter for specified test
  const results = data.concurrencyResults.filter(r => r.test_name === testName);

  // Get best result per CPU
  const bestByCpu: Record<string, ConcurrencyResult> = {};
  for (const r of results) {
    const current = bestByCpu[r.cpu_raw];
    if (!current || r.max_concurrency > current.max_concurrency) {
      bestByCpu[r.cpu_raw] = r;
    }
  }

  // Convert to array and sort by max_concurrency
  return Object.values(bestByCpu)
    .map(r => ({
      cpu_raw: r.cpu_raw,
      architecture: r.architecture,
      cpu_generation: r.cpu_generation,
      max_concurrency: r.max_concurrency,
      speeds: r.speeds_json,
    }))
    .sort((a, b) => b.max_concurrency - a.max_concurrency);
}
