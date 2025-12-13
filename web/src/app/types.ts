export interface BenchmarkResult {
  id: number
  submitted_at: string
  submitter_id: string | null
  cpu_raw: string
  cpu_brand: string | null
  cpu_model: string | null
  cpu_generation: number | null
  architecture: string | null
  test_name: string
  test_file: string
  bitrate_kbps: number
  time_seconds: number
  avg_fps: number
  avg_speed: number | null
  avg_watts: number | null
  fps_per_watt: number | null
  result_hash: string
  vendor: string
  data_quality_flags?: string[]
}

export interface CpuArchitecture {
  id: number
  pattern: string
  architecture: string
  codename: string | null
  release_year: number
  release_quarter: number | null
  sort_order: number
  h264_encode: boolean
  hevc_8bit_encode: boolean
  hevc_10bit_encode: boolean
  vp9_encode: boolean
  av1_encode: boolean
  igpu_name: string | null
  igpu_codename: string | null
  process_nm: string | null
  max_p_cores: number | null
  max_e_cores: number | null
  tdp_range: string | null
  die_layout: string | null
  gpu_eu_count: string | null
  vendor: string
  igpu_base_mhz?: number | null
  igpu_boost_mhz?: number | null
}

export interface ConcurrencyResult {
  id: number
  submitted_at: string
  submitter_id: string | null
  cpu_raw: string
  cpu_brand: string | null
  cpu_model: string | null
  cpu_generation: number | null
  architecture: string | null
  test_name: string
  test_file: string
  speeds_json: number[]
  max_concurrency: number
  result_hash: string
  vendor: string
}

export interface BenchmarkData {
  version: number
  lastUpdated: string
  meta: {
    totalResults: number
    uniqueCpus: number
    architecturesCount: number
    uniqueTests: number
  }
  architectures: CpuArchitecture[]
  results: BenchmarkResult[]
  concurrencyResults: ConcurrencyResult[]
  cpuFeatures: Record<string, { ecc_support: boolean }>
}

