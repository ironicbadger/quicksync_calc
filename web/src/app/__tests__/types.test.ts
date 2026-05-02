import { readFileSync } from 'node:fs'
import { describe, expect, it } from '@jest/globals'
import { parseBenchmarkData } from '../types'

describe('benchmarkDataSchema', () => {
  it('parses public/test-data.json', () => {
    const raw = readFileSync(new URL('../../../public/test-data.json', import.meta.url), 'utf-8')
    const json = JSON.parse(raw) as unknown
    expect(() => parseBenchmarkData(json)).not.toThrow()
  })

  it('accepts production-shaped fields', () => {
    const parsed = parseBenchmarkData({
      version: 1,
      lastUpdated: '2025-01-01T00:00:00.000Z',
      meta: { totalResults: 1, uniqueCpus: 1, architecturesCount: 1, uniqueTests: 1 },
      architectures: [
        {
          id: 1,
          pattern: '.*',
          architecture: 'Test Arch',
          codename: 'TEST',
          release_year: 2025,
          release_quarter: 1,
          sort_order: 1,
          h264_encode: 1,
          hevc_8bit_encode: 0,
          hevc_10bit_encode: 1,
          vp9_encode: 0,
          av1_encode: 0,
          igpu_name: 'Intel UHD Graphics Test',
          igpu_codename: 'GenTest',
          process_nm: 'Intel 7',
          max_p_cores: null,
          max_e_cores: null,
          tdp_range: '35-65W',
          die_layout: 'Monolithic',
          gpu_eu_count: '24 EU',
          vendor: 'intel',
        },
      ],
      results: [
        {
          id: 1,
          submitted_at: '2025-01-01T00:00:00.000Z',
          submitter_id: null,
          cpu_raw: 'Test CPU',
          cpu_brand: null,
          cpu_model: null,
          cpu_generation: null,
          architecture: null,
          test_name: 'h264_1080p',
          test_file: 'test_file',
          bitrate_kbps: 1000,
          time_seconds: 10,
          avg_fps: 100,
          avg_speed: null,
          avg_watts: null,
          fps_per_watt: null,
          result_hash: 'hash',
          vendor: 'intel',
          data_quality_flags: null,
        },
      ],
      concurrencyResults: [
        {
          id: 1,
          submitted_at: '2025-01-01T00:00:00.000Z',
          submitter_id: null,
          cpu_raw: 'Test CPU',
          cpu_brand: null,
          cpu_model: null,
          cpu_generation: null,
          architecture: null,
          test_name: 'h264_1080p',
          test_file: 'test_file',
          speeds_json: [1, 2, 3],
          max_concurrency: 3,
          result_hash: 'hash',
          vendor: 'intel',
        },
      ],
      cpuFeatures: {},
    })

    expect(parsed.architectures[0].h264_encode).toBe(1)
    expect(parsed.architectures[0].hevc_8bit_encode).toBe(0)
    expect(parsed.concurrencyResults[0].speeds_json).toBe('[1,2,3]')
    expect(parsed.results[0].data_quality_flags).toBeNull()
  })

  it('rejects invalid payloads', () => {
    expect(() => parseBenchmarkData({})).toThrow()
  })
})
