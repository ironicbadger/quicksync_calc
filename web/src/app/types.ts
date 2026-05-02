import { z } from 'zod'

const speedsJsonSchema = z.preprocess((value) => (Array.isArray(value) ? JSON.stringify(value) : value), z.string())

export const benchmarkResultSchema = z.object({
  id: z.number().int(),
  submitted_at: z.string(),
  submitter_id: z.string().nullable(),
  cpu_raw: z.string(),
  cpu_brand: z.string().nullable(),
  cpu_model: z.string().nullable(),
  cpu_generation: z.number().int().nullable(),
  architecture: z.string().nullable(),
  test_name: z.string(),
  test_file: z.string(),
  bitrate_kbps: z.number(),
  time_seconds: z.number(),
  avg_fps: z.number(),
  avg_speed: z.number().nullable(),
  avg_watts: z.number().nullable(),
  fps_per_watt: z.number().nullable(),
  result_hash: z.string(),
  vendor: z.string(),
  data_quality_flags: z.array(z.string()).nullable().optional(),
})

export type BenchmarkResult = z.infer<typeof benchmarkResultSchema>

export const cpuArchitectureSchema = z.object({
  id: z.number().int(),
  pattern: z.string(),
  architecture: z.string(),
  codename: z.string(),
  release_year: z.number().int(),
  release_quarter: z.number().int(),
  sort_order: z.number().int(),
  // Matches production `benchmarks.json` (0/1 ints).
  h264_encode: z.number().int().min(0).max(1),
  hevc_8bit_encode: z.number().int().min(0).max(1),
  hevc_10bit_encode: z.number().int().min(0).max(1),
  vp9_encode: z.number().int().min(0).max(1),
  av1_encode: z.number().int().min(0).max(1),
  igpu_name: z.string(),
  igpu_codename: z.string(),
  process_nm: z.string(),
  max_p_cores: z.number().int().nullable(),
  max_e_cores: z.number().int().nullable(),
  tdp_range: z.string(),
  die_layout: z.string(),
  gpu_eu_count: z.string(),
  vendor: z.string(),
})

export type CpuArchitecture = z.infer<typeof cpuArchitectureSchema>

export const concurrencyResultSchema = z.object({
  id: z.number().int(),
  submitted_at: z.string(),
  submitter_id: z.string().nullable(),
  cpu_raw: z.string(),
  cpu_brand: z.string().nullable(),
  cpu_model: z.string().nullable(),
  cpu_generation: z.number().int().nullable(),
  architecture: z.string().nullable(),
  test_name: z.string(),
  test_file: z.string(),
  speeds_json: speedsJsonSchema,
  max_concurrency: z.number().int(),
  result_hash: z.string(),
  vendor: z.string(),
})

export type ConcurrencyResult = z.infer<typeof concurrencyResultSchema>

export const benchmarkDataSchema = z.object({
  version: z.number().int(),
  lastUpdated: z.string(),
  meta: z.object({
    totalResults: z.number().int(),
    uniqueCpus: z.number().int(),
    architecturesCount: z.number().int(),
    uniqueTests: z.number().int(),
  }),
  architectures: z.array(cpuArchitectureSchema),
  results: z.array(benchmarkResultSchema),
  concurrencyResults: z.array(concurrencyResultSchema),
  cpuFeatures: z.record(z.string(), z.object({ ecc_support: z.boolean() })),
})

export type BenchmarkData = z.infer<typeof benchmarkDataSchema>

export function parseBenchmarkData(value: unknown): BenchmarkData {
  return benchmarkDataSchema.parse(value)
}
