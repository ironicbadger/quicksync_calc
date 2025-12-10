/**
 * R2 storage helpers for benchmark data.
 * Uses a single JSON file stored in Cloudflare R2.
 */

// Environment bindings
export interface Env {
  DATA_BUCKET: R2Bucket;
  PENDING_SUBMISSIONS: KVNamespace;
  TURNSTILE_SECRET: string;
  ADMIN_PASSPHRASE: string;
  ENVIRONMENT: string;
}

// Data types (matching existing schema)
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
  speeds_json: string;
  max_concurrency: number;
  result_hash: string;
  vendor: string;
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

export interface CpuFeatures {
  ecc_support: boolean;
}

export interface BenchmarkMeta {
  totalResults: number;
  uniqueCpus: number;
  architecturesCount: number;
  uniqueTests: number;
}

// Main data structure stored in R2
export interface BenchmarkData {
  version: number;
  lastUpdated: string;
  meta: BenchmarkMeta;
  architectures: CpuArchitecture[];
  results: BenchmarkResult[];
  concurrencyResults: ConcurrencyResult[];
  cpuFeatures: Record<string, CpuFeatures>;
}

const DATA_FILE = 'benchmarks.json';
const BACKUP_PREFIX = 'backups/benchmarks.';
const MAX_BACKUPS = 10;

/**
 * Read benchmark data from R2.
 */
export async function readData(bucket: R2Bucket): Promise<BenchmarkData> {
  const obj = await bucket.get(DATA_FILE);
  if (!obj) {
    // Return empty data structure if file doesn't exist
    return createEmptyData();
  }
  return await obj.json<BenchmarkData>();
}

/**
 * Write benchmark data to R2 with versioned backup.
 */
export async function writeData(bucket: R2Bucket, data: BenchmarkData): Promise<void> {
  // Create timestamped backup before writing
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupKey = `${BACKUP_PREFIX}${timestamp}.json`;

  // Copy current file to backup (if it exists)
  const current = await bucket.get(DATA_FILE);
  if (current) {
    await bucket.put(backupKey, current.body, {
      httpMetadata: { contentType: 'application/json' }
    });
  }

  // Update metadata
  data.version = (data.version || 0) + 1;
  data.lastUpdated = new Date().toISOString();
  data.meta = computeMeta(data);

  // Write new data
  await bucket.put(DATA_FILE, JSON.stringify(data), {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: 'public, max-age=300', // 5 minute CDN cache
    }
  });

  // Clean up old backups (keep last MAX_BACKUPS)
  await cleanupOldBackups(bucket);
}

/**
 * Compute meta stats from data.
 */
function computeMeta(data: BenchmarkData): BenchmarkMeta {
  const uniqueCpus = new Set(data.results.map(r => r.cpu_raw));
  const uniqueArchs = new Set(data.results.map(r => r.architecture).filter(Boolean));
  const uniqueTests = new Set(data.results.map(r => r.test_name));

  return {
    totalResults: data.results.length,
    uniqueCpus: uniqueCpus.size,
    architecturesCount: uniqueArchs.size,
    uniqueTests: uniqueTests.size,
  };
}

/**
 * Create empty data structure.
 */
function createEmptyData(): BenchmarkData {
  return {
    version: 0,
    lastUpdated: new Date().toISOString(),
    meta: {
      totalResults: 0,
      uniqueCpus: 0,
      architecturesCount: 0,
      uniqueTests: 0,
    },
    architectures: [],
    results: [],
    concurrencyResults: [],
    cpuFeatures: {},
  };
}

/**
 * Clean up old backups, keeping only the most recent MAX_BACKUPS.
 */
async function cleanupOldBackups(bucket: R2Bucket): Promise<void> {
  const list = await bucket.list({ prefix: BACKUP_PREFIX });

  if (list.objects.length <= MAX_BACKUPS) {
    return;
  }

  // Sort by key (timestamp is in the key, so alphabetical = chronological)
  const sorted = list.objects.sort((a, b) => a.key.localeCompare(b.key));

  // Delete oldest backups
  const toDelete = sorted.slice(0, sorted.length - MAX_BACKUPS);
  for (const obj of toDelete) {
    await bucket.delete(obj.key);
  }
}

/**
 * Get the next available ID for a new result.
 */
export function getNextId(results: BenchmarkResult[]): number {
  if (results.length === 0) return 1;
  return Math.max(...results.map(r => r.id)) + 1;
}

/**
 * Check if a result hash already exists (for deduplication).
 */
export function hashExists(results: BenchmarkResult[], hash: string): boolean {
  return results.some(r => r.result_hash === hash);
}
