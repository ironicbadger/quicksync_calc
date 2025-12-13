import type { BenchmarkResult } from '../app/types'

export type ComparisonMetric = 'avg_fps' | 'avg_watts' | 'fps_per_watt'

export type ComparisonByTestStats = {
  test_name: string
  result_count: number
  avg_fps: number
  avg_watts: number | null
  fps_per_watt: number | null
}

export type ComparisonOverallStats = {
  total_results: number
  unique_cpus?: number
  avg_fps: number
  avg_watts: number | null
  fps_per_watt: number | null
}

export type GenerationComparisonGroup = {
  generation: string
  architecture: string | null
  isArc: boolean
  overall: ComparisonOverallStats & { unique_cpus: number }
  by_test: ComparisonByTestStats[]
}

export type GenerationComparisonData = {
  groups: GenerationComparisonGroup[]
  all_tests: string[]
  numeric_generations: number[]
  baseline_overall: (ComparisonOverallStats & { unique_cpus: number }) | null
  baseline_by_test: ComparisonByTestStats[]
}

export type CpuComparisonGroup = {
  cpu_raw: string
  architecture: string | null
  cpu_generation: number | null
  overall: ComparisonOverallStats
  by_test: ComparisonByTestStats[]
}

export type CpuComparisonData = {
  cpus: CpuComparisonGroup[]
  all_tests: string[]
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function buildByTestStats(results: BenchmarkResult[]): ComparisonByTestStats[] {
  const byTest: Record<string, BenchmarkResult[]> = {}
  for (const r of results) {
    ;(byTest[r.test_name] ||= []).push(r)
  }

  return Object.entries(byTest).map(([testName, testResults]) => {
    const fpsVals = testResults.map((r) => r.avg_fps)
    const wattsVals = testResults.filter((r) => r.avg_watts !== null).map((r) => r.avg_watts as number)
    const effVals = testResults.filter((r) => r.fps_per_watt !== null).map((r) => r.fps_per_watt as number)

    return {
      test_name: testName,
      result_count: testResults.length,
      avg_fps: avg(fpsVals),
      avg_watts: wattsVals.length > 0 ? avg(wattsVals) : null,
      fps_per_watt: effVals.length > 0 ? avg(effVals) : null,
    }
  })
}

function buildOverallStats(results: BenchmarkResult[]): ComparisonOverallStats {
  const allFps = results.map((r) => r.avg_fps)
  const allWatts = results.filter((r) => r.avg_watts !== null).map((r) => r.avg_watts as number)
  const allEff = results.filter((r) => r.fps_per_watt !== null).map((r) => r.fps_per_watt as number)

  return {
    total_results: results.length,
    avg_fps: allFps.length > 0 ? avg(allFps) : 0,
    avg_watts: allWatts.length > 0 ? avg(allWatts) : null,
    fps_per_watt: allEff.length > 0 ? avg(allEff) : null,
  }
}

function computeGroupStats(results: BenchmarkResult[]) {
  const uniqueCpus = new Set<string>()
  for (const r of results) uniqueCpus.add(r.cpu_raw)

  const by_test = buildByTestStats(results)
  const overall = buildOverallStats(results)
  return { by_test, overall: { ...overall, unique_cpus: uniqueCpus.size } }
}

function isArcArchitecture(arch: string | null): boolean {
  return arch === 'Alchemist' || arch === 'Battlemage' || arch === 'Arc Alchemist'
}

export function computeGenerationComparisonData(
  pool: BenchmarkResult[],
  generationFilters: string[],
  architectureFilters: string[],
  baselinePool: BenchmarkResult[] = pool,
): GenerationComparisonData | null {
  const arcArchitectures = architectureFilters.filter((a) => isArcArchitecture(a))
  const hasArcFilter = arcArchitectures.length > 0
  const hasGenFilter = generationFilters.length > 0

  if (!hasGenFilter && !hasArcFilter) return null

  const groups: GenerationComparisonGroup[] = []
  const numericGenerationSet = new Set<number>()
  const allTests = new Set<string>()

  const baselineResults = baselinePool.filter((r) => r.cpu_generation === 8)
  const baselineStats = baselineResults.length > 0 ? computeGroupStats(baselineResults) : null
  if (baselineStats) {
    for (const t of baselineStats.by_test) allTests.add(t.test_name)
  }

  for (const gen of generationFilters) {
    let groupResults: BenchmarkResult[] = []
    let isArc = false

    if (gen === 'ultra-1') {
      groupResults = pool.filter((r) => r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake')
    } else if (gen === 'ultra-2') {
      groupResults = pool.filter((r) => r.architecture === 'Arrow Lake')
    } else if (gen === 'arc') {
      groupResults = pool.filter((r) => isArcArchitecture(r.architecture))
      isArc = true
    } else {
      const genNum = Number.parseInt(gen, 10)
      if (!Number.isNaN(genNum)) {
        groupResults = pool.filter((r) => r.cpu_generation === genNum)
      }
    }

    if (groupResults.length === 0) continue

    const stats = computeGroupStats(groupResults)
    groups.push({
      generation: gen,
      architecture: isArc ? 'Arc' : (groupResults[0]?.architecture ?? null),
      isArc,
      overall: stats.overall,
      by_test: stats.by_test,
    })

    if (!isArc && /^\d+$/.test(gen)) numericGenerationSet.add(Number.parseInt(gen, 10))
    for (const t of stats.by_test) allTests.add(t.test_name)
  }

  if (hasArcFilter && !generationFilters.includes('arc')) {
    const arcResults = pool.filter((r) => isArcArchitecture(r.architecture))
    if (arcResults.length > 0) {
      const stats = computeGroupStats(arcResults)
      groups.push({
        generation: 'arc',
        architecture: 'Arc',
        isArc: true,
        overall: stats.overall,
        by_test: stats.by_test,
      })
      for (const t of stats.by_test) allTests.add(t.test_name)
    }
  }

  if (groups.length === 0) return null

  return {
    groups,
    all_tests: Array.from(allTests).sort(),
    numeric_generations: generationFilters
      .filter((g) => /^\d+$/.test(g))
      .map((g) => Number.parseInt(g, 10))
      .filter((g) => numericGenerationSet.has(g)),
    baseline_overall: baselineStats?.overall ?? null,
    baseline_by_test: baselineStats?.by_test ?? [],
  }
}

export function computeCpuComparisonData(results: BenchmarkResult[], selectedCpus: string[]): CpuComparisonData | null {
  if (selectedCpus.length === 0) return null

  const filtered = results.filter((r) => selectedCpus.includes(r.cpu_raw))
  if (filtered.length === 0) return null

  const byCpu = new Map<string, BenchmarkResult[]>()
  for (const r of filtered) {
    const existing = byCpu.get(r.cpu_raw)
    if (existing) existing.push(r)
    else byCpu.set(r.cpu_raw, [r])
  }

  const allTests = new Set<string>()
  for (const r of filtered) allTests.add(r.test_name)

  const cpus: CpuComparisonGroup[] = []
  for (const cpu of selectedCpus) {
    const results = byCpu.get(cpu)
    if (!results || results.length === 0) continue

    const by_test = buildByTestStats(results)
    const overall = buildOverallStats(results)

    cpus.push({
      cpu_raw: cpu,
      architecture: results[0]?.architecture ?? null,
      cpu_generation: results[0]?.cpu_generation ?? null,
      overall,
      by_test,
    })
  }

  if (cpus.length === 0) return null

  return {
    cpus,
    all_tests: Array.from(allTests).sort(),
  }
}
