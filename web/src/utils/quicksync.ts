import type { BenchmarkData, BenchmarkResult, ConcurrencyResult } from '../app/types'

export function ordinal(n: number | string): string {
  const num = Number(n)
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = num % 100
  return `${num}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`
}

const VIRTUAL_GEN_DISPLAY: Record<string, string> = {
  'ultra-1': 'Ultra 1',
  'ultra-2': 'Ultra 2',
  arc: 'Arc',
}

const VIRTUAL_GEN_SORT_ORDER: Record<string, number> = {
  'ultra-1': 100,
  'ultra-2': 101,
  arc: 102,
}

export function formatGeneration(gen: string): string {
  return VIRTUAL_GEN_DISPLAY[gen] ?? `${ordinal(gen)} Gen`
}

function isVirtualGen(gen: string): boolean {
  return Object.hasOwn(VIRTUAL_GEN_DISPLAY, gen)
}

export function sortGenerations(generations: string[]): string[] {
  return [...generations].sort((a, b) => {
    const aVirtual = isVirtualGen(a)
    const bVirtual = isVirtualGen(b)

    if (!aVirtual && !bVirtual) return Number(b) - Number(a)
    if (aVirtual && bVirtual) return (VIRTUAL_GEN_SORT_ORDER[a] ?? 999) - (VIRTUAL_GEN_SORT_ORDER[b] ?? 999)
    return aVirtual ? 1 : -1
  })
}

export function stripIntelBranding(cpuName: string): string {
  return cpuName
    .replace(/Intel\(R\)\s*/gi, '')
    .replace(/Core\(TM\)\s*/gi, '')
    .replace(/\s+CPU\s*@\s*[\d.]+GHz/gi, '')
    .replace(/\s*\d{1,2}th Gen\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getCpuLink(architecture?: string | null, generation?: number | null): string | null {
  if (architecture && (architecture.includes('Arc') || architecture === 'Alchemist' || architecture === 'Battlemage')) {
    return '/gpu/arc/all'
  }
  if (architecture === 'Meteor Lake') return '/cpu/gen/ultra-1'
  if (architecture === 'Arrow Lake' || architecture === 'Lunar Lake') return '/cpu/gen/ultra-2'
  if (generation && generation >= 2 && generation <= 14) return `/cpu/gen/${generation}`
  return null
}

export type Filters = {
  generation: string[]
  architecture: string[]
  test: string[]
  cpu: string[]
  submitter: string[]
  ecc: Array<'yes' | 'no'>
}

export const EMPTY_FILTERS: Filters = {
  generation: [],
  architecture: [],
  test: [],
  cpu: [],
  submitter: [],
  ecc: [],
}

export function filterResults(data: BenchmarkData, filters: Filters): BenchmarkResult[] {
  return data.results.filter((r) => {
    if (filters.generation.length > 0) {
      const gen = String(r.cpu_generation)
      const isUltra1 = r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake'
      const isUltra2 = r.architecture === 'Arrow Lake'
      const isArc = r.architecture === 'Alchemist' || r.architecture === 'Battlemage'

      const matchesGen = filters.generation.includes(gen)
      const matchesUltra1 = filters.generation.includes('ultra-1') && isUltra1
      const matchesUltra2 = filters.generation.includes('ultra-2') && isUltra2
      const matchesArc = filters.generation.includes('arc') && isArc

      if (!matchesGen && !matchesUltra1 && !matchesUltra2 && !matchesArc) return false
    }

    if (filters.architecture.length > 0 && r.architecture) {
      if (!filters.architecture.includes(r.architecture)) return false
    }

    if (filters.test.length > 0) {
      if (!filters.test.includes(r.test_name)) return false
    }

    if (filters.cpu.length > 0) {
      if (!filters.cpu.includes(r.cpu_raw)) return false
    }

    if (filters.submitter.length > 0) {
      if (!r.submitter_id || !filters.submitter.includes(r.submitter_id)) return false
    }

    if (filters.ecc.length > 0) {
      const hasEcc = data.cpuFeatures[r.cpu_raw]?.ecc_support ?? false
      if (filters.ecc.includes('yes') && !hasEcc) return false
      if (filters.ecc.includes('no') && hasEcc) return false
    }

    return true
  })
}

export function computeFilterOptions(data: BenchmarkData) {
  const generations = new Set<string>()
  const architectures = new Set<string>()
  const tests = new Set<string>()

  for (const r of data.results) {
    if (r.cpu_generation !== null) generations.add(String(r.cpu_generation))
    if (r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake') generations.add('ultra-1')
    if (r.architecture === 'Arrow Lake') generations.add('ultra-2')
    if (r.architecture === 'Alchemist' || r.architecture === 'Battlemage') generations.add('arc')
    if (r.architecture) architectures.add(r.architecture)
    if (r.test_name) tests.add(r.test_name)
  }

  const knownTestOrder = ['h264_1080p', 'h264_1080p_cpu', 'h264_4k', 'hevc_8bit', 'hevc_4k_10bit']
  const testsSorted = [...tests].sort((a, b) => {
    const aIdx = knownTestOrder.indexOf(a)
    const bIdx = knownTestOrder.indexOf(b)
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })

  return {
    generations: sortGenerations([...generations]),
    architectures: [...architectures].sort(),
    tests: testsSorted,
  }
}

export function computeFilterCounts(data: BenchmarkData, filtered: BenchmarkResult[]) {
  const generations: Record<string, number> = {}
  const architectures: Record<string, number> = {}
  const tests: Record<string, number> = {}
  const cpus: Record<string, number> = {}
  const submitters: Record<string, number> = {}
  let eccYes = 0
  let eccNo = 0

  for (const r of filtered) {
    if (r.cpu_generation !== null) {
      const gen = String(r.cpu_generation)
      generations[gen] = (generations[gen] || 0) + 1
    }

    if (r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake') generations['ultra-1'] = (generations['ultra-1'] || 0) + 1
    if (r.architecture === 'Arrow Lake') generations['ultra-2'] = (generations['ultra-2'] || 0) + 1
    if (r.architecture === 'Alchemist' || r.architecture === 'Battlemage') generations.arc = (generations.arc || 0) + 1

    if (r.architecture) architectures[r.architecture] = (architectures[r.architecture] || 0) + 1
    tests[r.test_name] = (tests[r.test_name] || 0) + 1
    cpus[r.cpu_raw] = (cpus[r.cpu_raw] || 0) + 1

    if (r.submitter_id) submitters[r.submitter_id] = (submitters[r.submitter_id] || 0) + 1

    const hasEcc = data.cpuFeatures[r.cpu_raw]?.ecc_support ?? false
    if (hasEcc) eccYes += 1
    else eccNo += 1
  }

  return { generations, architectures, tests, cpus, submitters, ecc: { yes: eccYes, no: eccNo } }
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

type ArchCodecSupport = { av1: boolean; hevc10: boolean; vp9: boolean }

export type OverallCpuScoreRow = {
  cpu_raw: string
  architecture: string | null
  cpu_generation: number | null
  score: number
  hasFlaggedResults: boolean
}

export function calculateOverallCpuScores(data: BenchmarkData): OverallCpuScoreRow[] {
  const byCpu: Record<string, BenchmarkResult[]> = {}
  for (const r of data.results) {
    ;(byCpu[r.cpu_raw] ||= []).push(r)
  }

  const concurrencyByCpu: Record<string, ConcurrencyResult[]> = {}
  for (const r of data.concurrencyResults || []) {
    ;(concurrencyByCpu[r.cpu_raw] ||= []).push(r)
  }

  const cpuAvgFps: Array<{ cpu: string; fps: number }> = []
  const cpuAvgEfficiency: Array<{ cpu: string; eff: number }> = []
  const cpuMaxConcurrency: Array<{ cpu: string; conc: number }> = []

  for (const [cpu, results] of Object.entries(byCpu)) {
    cpuAvgFps.push({ cpu, fps: avg(results.map((r) => r.avg_fps)) })

    const effResults = results.filter(
      (r) =>
        r.fps_per_watt !== null &&
        r.avg_watts !== null &&
        r.avg_watts >= 3.0 &&
        (!r.data_quality_flags || !r.data_quality_flags.includes('power_too_low')),
    )
    if (effResults.length > 0) cpuAvgEfficiency.push({ cpu, eff: avg(effResults.map((r) => r.fps_per_watt ?? 0)) })

    const concResults = concurrencyByCpu[cpu]
    if (concResults && concResults.length > 0) {
      const maxConc = Math.max(...concResults.map((r) => r.max_concurrency))
      cpuMaxConcurrency.push({ cpu, conc: maxConc })
    }
  }

  cpuAvgFps.sort((a, b) => a.fps - b.fps)
  cpuAvgEfficiency.sort((a, b) => a.eff - b.eff)
  cpuMaxConcurrency.sort((a, b) => a.conc - b.conc)

  const fpsPercentile: Record<string, number> = {}
  cpuAvgFps.forEach((item, idx) => {
    fpsPercentile[item.cpu] = Math.round((idx / Math.max(cpuAvgFps.length - 1, 1)) * 100)
  })

  const effPercentile: Record<string, number> = {}
  cpuAvgEfficiency.forEach((item, idx) => {
    effPercentile[item.cpu] = Math.round((idx / Math.max(cpuAvgEfficiency.length - 1, 1)) * 100)
  })

  const concPercentile: Record<string, number> = {}
  cpuMaxConcurrency.forEach((item, idx) => {
    concPercentile[item.cpu] = Math.round((idx / Math.max(cpuMaxConcurrency.length - 1, 1)) * 100)
  })

  const archCodecs: Record<string, ArchCodecSupport> = {}
  for (const arch of data.architectures) {
    archCodecs[arch.architecture] = { av1: arch.av1_encode, hevc10: arch.hevc_10bit_encode, vp9: arch.vp9_encode }
  }

  const scores: OverallCpuScoreRow[] = []
  for (const [cpu, results] of Object.entries(byCpu)) {
    const perfScore = fpsPercentile[cpu] ?? 50

    const hasFlaggedResults = results.some((r) => r.data_quality_flags && r.data_quality_flags.length > 0)
    const effScore = effPercentile[cpu] ?? (hasFlaggedResults ? 0 : 50)
    const concScore = concPercentile[cpu] ?? 50

    const arch = results[0]?.architecture ?? null
    const codecs = arch ? archCodecs[arch] : null
    let codecScore = 50
    if (codecs) {
      if (codecs.av1) codecScore += 25
      if (codecs.hevc10) codecScore += 15
      if (codecs.vp9) codecScore += 10
    }

    const score = Math.min(100, Math.max(0, Math.round(perfScore * 0.3 + effScore * 0.25 + concScore * 0.25 + codecScore * 0.2)))

    scores.push({
      cpu_raw: cpu,
      architecture: results[0]?.architecture ?? null,
      cpu_generation: results[0]?.cpu_generation ?? null,
      score,
      hasFlaggedResults,
    })
  }

  return scores.sort((a, b) => b.score - a.score)
}

export function calculateOverallCpuScoreMap(data: BenchmarkData): Record<string, number> {
  const rows = calculateOverallCpuScores(data)
  return Object.fromEntries(rows.map((r) => [r.cpu_raw, r.score]))
}

export function calculateGenerationCpuScoreMap(data: BenchmarkData): Record<string, number> {
  const byCpu: Record<string, BenchmarkResult[]> = {}
  for (const r of data.results) {
    ;(byCpu[r.cpu_raw] ||= []).push(r)
  }

  const cpuAvgFps: Array<{ cpu: string; fps: number }> = []
  const cpuAvgEfficiency: Array<{ cpu: string; eff: number }> = []

  for (const [cpu, results] of Object.entries(byCpu)) {
    cpuAvgFps.push({ cpu, fps: avg(results.map((r) => r.avg_fps)) })

    const effResults = results.filter(
      (r) =>
        r.fps_per_watt !== null &&
        r.avg_watts !== null &&
        r.avg_watts >= 3.0 &&
        (!r.data_quality_flags || !r.data_quality_flags.includes('power_too_low')),
    )
    if (effResults.length > 0) cpuAvgEfficiency.push({ cpu, eff: avg(effResults.map((r) => r.fps_per_watt ?? 0)) })
  }

  cpuAvgFps.sort((a, b) => a.fps - b.fps)
  cpuAvgEfficiency.sort((a, b) => a.eff - b.eff)

  const fpsPercentile: Record<string, number> = {}
  cpuAvgFps.forEach((item, idx) => {
    fpsPercentile[item.cpu] = Math.round((idx / Math.max(cpuAvgFps.length - 1, 1)) * 100)
  })

  const effPercentile: Record<string, number> = {}
  cpuAvgEfficiency.forEach((item, idx) => {
    effPercentile[item.cpu] = Math.round((idx / Math.max(cpuAvgEfficiency.length - 1, 1)) * 100)
  })

  const archCodecs: Record<string, ArchCodecSupport> = {}
  for (const arch of data.architectures) {
    archCodecs[arch.architecture] = { av1: arch.av1_encode, hevc10: arch.hevc_10bit_encode, vp9: arch.vp9_encode }
  }

  const scores: Record<string, number> = {}
  for (const [cpu, results] of Object.entries(byCpu)) {
    const perfScore = fpsPercentile[cpu] ?? 50
    const hasFlaggedResults = results.some((r) => r.data_quality_flags && r.data_quality_flags.length > 0)
    const effScore = effPercentile[cpu] ?? (hasFlaggedResults ? 0 : 50)

    const arch = results[0]?.architecture ?? null
    const codecs = arch ? archCodecs[arch] : null
    let codecScore = 50
    if (codecs) {
      if (codecs.av1) codecScore += 25
      if (codecs.hevc10) codecScore += 15
      if (codecs.vp9) codecScore += 10
    }

    const score = Math.min(100, Math.max(0, Math.round(perfScore * 0.4 + effScore * 0.35 + codecScore * 0.25)))
    scores[cpu] = score
  }

  return scores
}

export type BoxplotPoint = {
  group: string
  test: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  count: number
}

function percentile(sorted: number[], p: number) {
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (idx - lower) * (sorted[upper] - sorted[lower])
}

function computeBoxplot(results: BenchmarkResult[], metric: 'avg_fps' | 'avg_watts' | 'fps_per_watt', groupKey: string, testName: string): BoxplotPoint | null {
  const values = results
    .filter((r) => r[metric] !== null)
    .map((r) => r[metric] as number)
    .sort((a, b) => a - b)

  if (values.length === 0) return null

  return {
    group: groupKey,
    test: testName,
    min: values[0],
    q1: percentile(values, 25),
    median: percentile(values, 50),
    q3: percentile(values, 75),
    max: values[values.length - 1],
    count: values.length,
  }
}

export function computeBoxplotData(
  data: BenchmarkData,
  metric: 'avg_fps' | 'avg_watts' | 'fps_per_watt',
  selectedTests: string[],
): BoxplotPoint[] {
  let filtered = data.results
  if (selectedTests.length > 0) filtered = filtered.filter((r) => selectedTests.includes(r.test_name))

  let metricFiltered = filtered
  if (metric === 'fps_per_watt') {
    metricFiltered = filtered.filter(
      (r) =>
        r.avg_watts !== null &&
        r.avg_watts >= 3.0 &&
        (!r.data_quality_flags || !r.data_quality_flags.includes('power_too_low')),
    )
  }

  const byGenAndTest: Record<string, BenchmarkResult[]> = {}
  for (const r of metricFiltered) {
    let groupKey: string | null = null

    if (r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake') groupKey = 'U1'
    else if (r.architecture === 'Arrow Lake') groupKey = 'U2'
    else if (r.architecture === 'Alchemist' || r.architecture === 'Battlemage') groupKey = 'Arc'
    else if (r.cpu_generation !== null) groupKey = String(r.cpu_generation)

    if (!groupKey) continue

    const key = `${groupKey}|${r.test_name}`
    ;(byGenAndTest[key] ||= []).push(r)
  }

  const out: BoxplotPoint[] = []
  for (const [key, results] of Object.entries(byGenAndTest)) {
    const [groupKey, testName] = key.split('|')
    const stats = computeBoxplot(results, metric, groupKey, testName)
    if (stats) out.push(stats)
  }
  return out
}

export function computeConcurrencyByGenAndTest(concurrencyResults: ConcurrencyResult[]) {
  const byGenAndTest: Record<string, { group: string; test: string; max_concurrency: number }> = {}

  for (const r of concurrencyResults) {
    let groupKey: string | null = null
    if (r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake') groupKey = 'U1'
    else if (r.architecture === 'Arrow Lake') groupKey = 'U2'
    else if (r.architecture === 'Alchemist' || r.architecture === 'Battlemage') groupKey = 'Arc'
    else if (r.cpu_generation !== null) groupKey = String(r.cpu_generation)
    if (!groupKey) continue

    const key = `${groupKey}|${r.test_name}`
    const current = byGenAndTest[key]
    if (!current || r.max_concurrency > current.max_concurrency) byGenAndTest[key] = { group: groupKey, test: r.test_name, max_concurrency: r.max_concurrency }
  }

  return byGenAndTest
}

