import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ScoreBadge } from '../../components/ScoreBadge'
import { useBenchmarkData } from '../../app/BenchmarkDataProvider'
import type { BenchmarkData, BenchmarkResult, CpuArchitecture } from '../../app/types'
import { useDocumentTitle } from '../../layout/useDocumentTitle'
import { ChartJS } from '../../utils/chartjs'
import { calculateGenerationCpuScoreMap, stripIntelBranding } from '../../utils/quicksync'
import './styles.css'

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
  arc: { display_name: 'Intel Arc GPUs', architectures: ['Alchemist', 'Battlemage', 'Arc Alchemist'] },
}

const generationNames: Record<string, string> = {
  '6': '6th Gen (Skylake)',
  '7': '7th Gen (Kaby Lake)',
  '8': '8th Gen (Coffee Lake)',
  '9': '9th Gen (Coffee Lake Refresh)',
  '10': '10th Gen (Comet Lake)',
  '11': '11th Gen (Rocket/Tiger Lake)',
  '12': '12th Gen (Alder Lake)',
  '13': '13th Gen (Raptor Lake)',
  '14': '14th Gen (Raptor Lake Refresh)',
  'ultra-1': 'Intel Core Ultra Series 1',
  'ultra-2': 'Intel Core Ultra Series 2',
  arc: 'Intel Arc GPUs',
}

const allGens = ['6', '7', '8', '9', '10', '11', '12', '13', '14', 'ultra-1', 'ultra-2', 'arc']

function avg(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

type CpuModelStats = {
  cpu_raw: string
  result_count: number
  avg_fps: number
  avg_watts: number
  fps_per_watt: number
  has_flagged: boolean
}

type GenData = {
  display_name: string
  architecture: { name: string }
  codec_support: {
    h264_encode: boolean
    hevc_8bit_encode: boolean
    hevc_10bit_encode: boolean
    vp9_encode: boolean
    av1_encode: boolean
  }
  benchmark_stats: {
    total_results: number
    unique_cpus: number
    avg_fps: number
    avg_watts: number
    fps_per_watt: number
    by_test: Array<{
      test_name: string
      count: number
      avg_fps: number
      min_fps: number
      max_fps: number
      avg_watts: number
      fps_per_watt: number
    }>
  }
  baseline_comparison: { fps_diff_percent: number | null; efficiency_diff_percent: number | null }
  baseline_by_test: Array<{ test_name: string; avg_fps: number; avg_watts: number; fps_per_watt: number }>
  cpu_models: CpuModelStats[]
  arch_variants: Array<{
    igpu_name: string | null
    igpu_codename: string | null
    igpu_base_mhz?: number | null
    igpu_boost_mhz?: number | null
    process_nm: string | null
    max_p_cores: number | null
    max_e_cores: number | null
    tdp_range: string | null
    die_layout: string | null
    gpu_eu_count: string | null
    release_year: number
    release_quarter: number | null
    codename: string | null
    pattern: string
    tested_cpus: string[]
  }>
  has_multiple_variants: boolean
  concurrency_by_test: Record<string, Record<string, { cpu_raw: string; max_concurrency: number }>>
}

function getGenerationDetail(data: BenchmarkData, genId: string): GenData | null {
  const info = generationInfo[genId]
  if (!info) return null

  const isNumericGen = /^\d+$/.test(genId)
  const genResults = data.results.filter((r) => {
    if (isNumericGen) return r.cpu_generation === Number.parseInt(genId, 10)
    if (genId === 'ultra-1') return r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake'
    if (genId === 'ultra-2') return r.architecture === 'Arrow Lake'
    if (genId === 'arc') return r.architecture === 'Alchemist' || r.architecture === 'Battlemage' || r.architecture === 'Arc Alchemist'
    return false
  })

  const allArchData = data.architectures.filter((a) => info.architectures.includes(a.architecture))
  const archData = allArchData[0]

  const codecSupport = {
    h264_encode: archData?.h264_encode ?? true,
    hevc_8bit_encode: archData?.hevc_8bit_encode ?? false,
    hevc_10bit_encode: archData?.hevc_10bit_encode ?? false,
    vp9_encode: archData?.vp9_encode ?? false,
    av1_encode: archData?.av1_encode ?? false,
  }

  const uniqueCpus = new Set(genResults.map((r) => r.cpu_raw))
  const avgFps = avg(genResults.map((r) => r.avg_fps))
  const avgWatts = avg(genResults.filter((r) => r.avg_watts !== null).map((r) => r.avg_watts as number))

  const validEfficiencyResults = genResults.filter(
    (r) =>
      r.fps_per_watt !== null &&
      r.avg_watts !== null &&
      r.avg_watts >= 3.0 &&
      (!r.data_quality_flags || !r.data_quality_flags.includes('power_too_low')),
  )
  const fpsPerWatt = avg(validEfficiencyResults.map((r) => r.fps_per_watt as number))

  const byTest: Record<string, BenchmarkResult[]> = {}
  for (const r of genResults) {
    ;(byTest[r.test_name] ||= []).push(r)
  }

  const testStats = Object.entries(byTest).map(([test, results]) => {
    const validEff = results.filter(
      (r) =>
        r.fps_per_watt !== null &&
        r.avg_watts !== null &&
        r.avg_watts >= 3.0 &&
        (!r.data_quality_flags || !r.data_quality_flags.includes('power_too_low')),
    )
    return {
      test_name: test,
      count: results.length,
      avg_fps: avg(results.map((r) => r.avg_fps)),
      min_fps: Math.min(...results.map((r) => r.avg_fps)),
      max_fps: Math.max(...results.map((r) => r.avg_fps)),
      avg_watts: avg(results.filter((r) => r.avg_watts !== null).map((r) => r.avg_watts as number)),
      fps_per_watt: avg(validEff.map((r) => r.fps_per_watt as number)),
    }
  })

  const baseline8 = data.results.filter((r) => r.cpu_generation === 8)
  const baselineFps = avg(baseline8.map((r) => r.avg_fps))
  const baselineEfficiency = avg(baseline8.filter((r) => r.fps_per_watt !== null).map((r) => r.fps_per_watt as number))

  const fpsDiff = baselineFps > 0 ? Math.round(((avgFps - baselineFps) / baselineFps) * 100) : null
  const effDiff = baselineEfficiency > 0 ? Math.round(((fpsPerWatt - baselineEfficiency) / baselineEfficiency) * 100) : null

  const baselineByTest = Object.keys(byTest).map((test) => {
    const baseResults = baseline8.filter((r) => r.test_name === test)
    return {
      test_name: test,
      avg_fps: avg(baseResults.map((r) => r.avg_fps)),
      avg_watts: avg(baseResults.filter((r) => r.avg_watts !== null).map((r) => r.avg_watts as number)),
      fps_per_watt: avg(baseResults.filter((r) => r.fps_per_watt !== null).map((r) => r.fps_per_watt as number)),
    }
  })

  const cpuStats: Record<string, BenchmarkResult[]> = {}
  for (const r of genResults) {
    ;(cpuStats[r.cpu_raw] ||= []).push(r)
  }

  const cpuModels: CpuModelStats[] = Object.entries(cpuStats).map(([cpu, results]) => {
    const validEff = results.filter(
      (r) =>
        r.fps_per_watt !== null &&
        r.avg_watts !== null &&
        r.avg_watts >= 3.0 &&
        (!r.data_quality_flags || !r.data_quality_flags.includes('power_too_low')),
    )
    const hasFlaggedResults = results.some((r) => r.data_quality_flags && r.data_quality_flags.length > 0)
    return {
      cpu_raw: cpu,
      result_count: results.length,
      avg_fps: avg(results.map((r) => r.avg_fps)),
      avg_watts: avg(results.filter((r) => r.avg_watts !== null).map((r) => r.avg_watts as number)),
      fps_per_watt: avg(validEff.map((r) => r.fps_per_watt as number)),
      has_flagged: hasFlaggedResults,
    }
  })

  const archVariants = allArchData.map((arch: CpuArchitecture) => {
    let matchedCpus: string[] = []
    if (arch.pattern) {
      try {
        const regex = new RegExp(arch.pattern)
        matchedCpus = Array.from(uniqueCpus).filter((cpu) => {
          const modelMatch = cpu.match(/i[3579]-\d{4,5}[A-Z]?|Ultra \d \d{3}[A-Z]?/i)
          if (modelMatch) return regex.test(modelMatch[0])
          return regex.test(cpu)
        })
      } catch {
        // ignore invalid regex patterns
      }
    }

    return {
      igpu_name: arch.igpu_name,
      igpu_codename: arch.igpu_codename,
      igpu_base_mhz: arch.igpu_base_mhz ?? null,
      igpu_boost_mhz: arch.igpu_boost_mhz ?? null,
      process_nm: arch.process_nm,
      max_p_cores: arch.max_p_cores,
      max_e_cores: arch.max_e_cores,
      tdp_range: arch.tdp_range,
      die_layout: arch.die_layout,
      gpu_eu_count: arch.gpu_eu_count,
      release_year: arch.release_year,
      release_quarter: arch.release_quarter,
      codename: arch.codename,
      pattern: arch.pattern,
      tested_cpus: matchedCpus,
    }
  })

  const genConcurrency = (data.concurrencyResults || []).filter((r) => {
    if (isNumericGen) return r.cpu_generation === Number.parseInt(genId, 10)
    if (genId === 'ultra-1') return r.architecture === 'Meteor Lake' || r.architecture === 'Lunar Lake'
    if (genId === 'ultra-2') return r.architecture === 'Arrow Lake'
    if (genId === 'arc') return r.architecture === 'Alchemist' || r.architecture === 'Battlemage' || r.architecture === 'Arc Alchemist'
    return false
  })

  const concurrencyByTest: GenData['concurrency_by_test'] = {}
  for (const r of genConcurrency) {
    concurrencyByTest[r.test_name] ||= {}
    const current = concurrencyByTest[r.test_name][r.cpu_raw]
    if (!current || r.max_concurrency > current.max_concurrency) concurrencyByTest[r.test_name][r.cpu_raw] = { cpu_raw: r.cpu_raw, max_concurrency: r.max_concurrency }
  }

  return {
    display_name: info.display_name,
    architecture: { name: archData?.architecture ?? info.architectures[0] },
    codec_support: codecSupport,
    benchmark_stats: {
      total_results: genResults.length,
      unique_cpus: uniqueCpus.size,
      avg_fps: avgFps,
      avg_watts: avgWatts,
      fps_per_watt: fpsPerWatt,
      by_test: testStats,
    },
    baseline_comparison: { fps_diff_percent: fpsDiff, efficiency_diff_percent: effDiff },
    baseline_by_test: baselineByTest,
    cpu_models: cpuModels,
    arch_variants: archVariants,
    has_multiple_variants: archVariants.length > 1,
    concurrency_by_test: concurrencyByTest,
  }
}

function testBadgeClass(testName: string) {
  return testName.includes('hevc') ? 'hevc' : testName.includes('cpu') ? 'cpu' : 'h264'
}

function getIgpuTier(euCount: string | null) {
  if (!euCount) return null
  const eus = Number.parseInt(euCount, 10)
  if (eus >= 64) return { tier: 'High', className: 'igpu-tier-high' }
  if (eus >= 32) return { tier: 'Mid', className: 'igpu-tier-mid' }
  return { tier: 'Entry', className: 'igpu-tier-entry' }
}

function pricingLinks(genId: string) {
  const isNumeric = /^\d+$/.test(genId)
  if (isNumeric) {
    return {
      note: `Search for ${generationNames[genId] || `Generation ${genId}`} processors on popular marketplaces:`,
      links: [
        { label: 'eBay', href: `https://www.ebay.com/sch/i.html?_nkw=intel+${genId}th+gen+cpu` },
        { label: 'Amazon', href: `https://www.amazon.com/s?k=intel+${genId}th+gen+processor` },
        { label: 'Newegg', href: `https://www.newegg.com/p/pl?d=intel+${genId}th+gen` },
      ],
    }
  }

  if (genId === 'arc') {
    return {
      note: 'Search for Intel Arc discrete graphics cards:',
      links: [
        { label: 'eBay', href: 'https://www.ebay.com/sch/i.html?_nkw=intel+arc+gpu' },
        { label: 'Amazon', href: 'https://www.amazon.com/s?k=intel+arc+graphics+card' },
        { label: 'Newegg', href: 'https://www.newegg.com/p/pl?d=intel+arc' },
      ],
    }
  }

  return {
    note: `Search for ${generationNames[genId] || `Generation ${genId}`} processors on popular marketplaces:`,
    links: [
      { label: 'eBay', href: 'https://www.ebay.com/sch/i.html?_nkw=intel+core+ultra+cpu' },
      { label: 'Amazon', href: 'https://www.amazon.com/s?k=intel+core+ultra+processor' },
      { label: 'Newegg', href: 'https://www.newegg.com/p/pl?d=intel+core+ultra' },
    ],
  }
}

function useGenCharts(genId: string, genData: GenData | null) {
  const fpsRef = useRef<HTMLCanvasElement | null>(null)
  const wattsRef = useRef<HTMLCanvasElement | null>(null)
  const effRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!genData) return
    if (!genData.benchmark_stats.by_test?.length) return

    const currentGenData = genData
    const genColor = { bg: 'rgba(6, 182, 212, 0.7)', border: 'rgb(6, 182, 212)' }
    const baselineColor = { bg: 'rgba(120, 120, 130, 0.6)', border: 'rgb(120, 120, 130)' }

    const byTest = currentGenData.benchmark_stats.by_test
    const baselineByTest = currentGenData.baseline_by_test || []
    const isBaseline = genId === '8'

    const testNames = byTest.map((t) => t.test_name)

    function buildDatasets(metric: 'avg_fps' | 'avg_watts' | 'fps_per_watt') {
      const datasets = [
        {
          label: currentGenData.display_name,
          data: testNames.map((name) => byTest.find((t) => t.test_name === name)?.[metric] || 0),
          backgroundColor: genColor.bg,
          borderColor: genColor.border,
          borderWidth: 1,
        },
      ]

      if (!isBaseline && baselineByTest.length > 0) {
        datasets.push({
          label: '8th Gen (Baseline)',
          data: testNames.map((name) => baselineByTest.find((t) => t.test_name === name)?.[metric] || 0),
          backgroundColor: baselineColor.bg,
          borderColor: baselineColor.border,
          borderWidth: 1,
        })
      }

      return datasets
    }

    function createChart(canvas: HTMLCanvasElement, title: string, yLabel: string, metric: 'avg_fps' | 'avg_watts' | 'fps_per_watt') {
      return new ChartJS(canvas, {
        type: 'bar',
        data: { labels: testNames, datasets: buildDatasets(metric) },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: '#f1f5f9', font: { size: 11 } } },
            title: { display: true, text: title, color: '#f1f5f9', font: { size: 13, weight: 600 } },
          },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#334155' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' }, title: { display: true, text: yLabel, color: '#94a3b8' } },
          },
        },
      })
    }

    const charts: Array<{ destroy: () => void }> = []
    if (fpsRef.current) charts.push(createChart(fpsRef.current, 'Average FPS by Test Type', 'Frames per Second', 'avg_fps'))
    if (wattsRef.current) charts.push(createChart(wattsRef.current, 'Average Power Usage by Test Type', 'Watts', 'avg_watts'))
    if (effRef.current) charts.push(createChart(effRef.current, 'Efficiency (FPS per Watt) by Test Type', 'FPS/Watt', 'fps_per_watt'))

    return () => charts.forEach((c) => c.destroy())
  }, [genData, genId])

  return { fpsRef, wattsRef, effRef }
}

export function CpuGenPage() {
  const params = useParams()
  const genId = params.gen || ''
  const { state } = useBenchmarkData()

  const displayName = generationNames[genId] || `Generation ${genId}`
  useDocumentTitle(`${displayName} - QuickSync Benchmarks`)

  const genData = useMemo(() => (state.status === 'ready' ? getGenerationDetail(state.data, genId) : null), [genId, state])
  const scoreMap = useMemo(() => (state.status === 'ready' ? calculateGenerationCpuScoreMap(state.data) : {}), [state])

  const currentIdx = allGens.indexOf(genId)
  const prevGen = currentIdx > 0 ? allGens[currentIdx - 1] : null
  const nextGen = currentIdx >= 0 && currentIdx < allGens.length - 1 ? allGens[currentIdx + 1] : null

  const charts = useGenCharts(genId, genData)

  if (state.status === 'loading') {
    return (
      <div className="page-cpu-gen">
        <div className="container">
          <div id="loading-state" className="loading-state">
            <p>Loading generation data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="page-cpu-gen">
        <div className="container">
          <div id="error-state" className="error-state">
            <h2>Failed to Load Data</h2>
            <p id="error-message">{state.error.message}</p>
            <Link to="/" className="back-link">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!genData) {
    return (
      <div className="page-cpu-gen">
        <div className="container">
          <div id="error-state" className="error-state">
            <h2>Failed to Load Data</h2>
            <p id="error-message">Unknown generation</p>
            <Link to="/" className="back-link">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const stats = genData.benchmark_stats

  const cpuModelsWithScores = genData.cpu_models
    .map((cpu) => ({ ...cpu, score: scoreMap[cpu.cpu_raw] ?? null }))
    .sort((a, b) => {
      if (a.score === null && b.score === null) return 0
      if (a.score === null) return 1
      if (b.score === null) return -1
      return b.score - a.score
    })

  const winner = cpuModelsWithScores.length >= 2 && cpuModelsWithScores[0].score ? cpuModelsWithScores[0] : null

  const prices = pricingLinks(genId)

  const processExplainers: Record<string, { equiv: string; url: string }> = {
    'Intel 7': { equiv: '~10nm ESF', url: 'https://en.wikipedia.org/wiki/Intel_7' },
    'Intel 4': { equiv: '~7nm EUV', url: 'https://en.wikipedia.org/wiki/Intel_4' },
    'Intel 3': { equiv: '~5nm class', url: 'https://en.wikipedia.org/wiki/Intel_3' },
    'Intel 20A': { equiv: '~3nm RibbonFET', url: 'https://en.wikipedia.org/wiki/Intel_20A' },
    'Intel 18A': { equiv: '~2nm class', url: 'https://en.wikipedia.org/wiki/Intel_18A' },
    '14nm': { equiv: '14nm++', url: 'https://en.wikipedia.org/wiki/14_nm_process' },
    '10nm': { equiv: '10nm SuperFin', url: 'https://en.wikipedia.org/wiki/10_nm_process' },
    'TSMC N6': { equiv: '~7nm EUV', url: 'https://en.wikipedia.org/wiki/TSMC_7nm_process' },
    'TSMC N5': { equiv: '5nm class', url: 'https://en.wikipedia.org/wiki/5_nm_process' },
    'TSMC N3': { equiv: '3nm class', url: 'https://en.wikipedia.org/wiki/3_nm_process' },
  }

  const codecs = [
    { key: 'h264_encode', name: 'H.264' },
    { key: 'hevc_8bit_encode', name: 'HEVC 8-bit' },
    { key: 'hevc_10bit_encode', name: 'HEVC 10-bit' },
    { key: 'vp9_encode', name: 'VP9' },
    { key: 'av1_encode', name: 'AV1' },
  ] as const

  const tldrSupports = codecs
    .filter((c) => genData.codec_support[c.key])
    .map((c) => c.name)
    .join(', ')

  const fpsDiff = genId !== '8' ? genData.baseline_comparison.fps_diff_percent : null
  const effDiff = genId !== '8' ? genData.baseline_comparison.efficiency_diff_percent : null

  const concurrencyTests = Object.keys(genData.concurrency_by_test || {})
  const hasConcurrency = concurrencyTests.length > 0
  const testOrder = ['h264_1080p', 'hevc_8bit', 'h264_4k', 'hevc_4k_10bit']
  const testLabels: Record<string, string> = {
    h264_1080p: 'H.264 1080p',
    hevc_8bit: 'HEVC 1080p',
    h264_4k: 'H.264 4K',
    hevc_4k_10bit: 'HEVC 4K 10-bit',
  }
  const sortedConcurrencyTests = concurrencyTests.sort((a, b) => {
    const aIdx = testOrder.indexOf(a)
    const bIdx = testOrder.indexOf(b)
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })

  return (
    <div className="page-cpu-gen">
      <div className="container">
        <div className="page-header">
          <div className="nav-arrows">
            {prevGen ? (
              <Link to={`/cpu/gen/${prevGen}`} className="nav-prev">
                &larr; {generationNames[prevGen]}
              </Link>
            ) : (
              <span className="nav-placeholder" />
            )}
          </div>

          <div className="header-center">
            <h1 id="page-title">{displayName}</h1>
            <span id="arch-subtitle" className="arch-subtitle">
              {genData.architecture.name || ''}
            </span>
          </div>

          <div className="nav-arrows">
            {nextGen ? (
              <Link to={`/cpu/gen/${nextGen}`} className="nav-next">
                {generationNames[nextGen]} &rarr;
              </Link>
            ) : (
              <span className="nav-placeholder" />
            )}
          </div>
        </div>

        <section className="timeline-section card">
          <h2>Generation Timeline</h2>
          <div className="timeline-slider" id="timeline-slider">
            {allGens.map((g) => (
              <Link key={g} to={`/cpu/gen/${g}`} className={`timeline-item${g === genId ? ' active' : ''}`}>
                {/^\d+$/.test(g) ? `${g}th` : g.replace('-', ' ').replace('ultra', 'Ultra ')}
              </Link>
            ))}
          </div>
        </section>

        <div id="content">
          <section className="tldr-section card">
            <h2>TL;DR</h2>
            <p className="tldr-text" id="tldr-text">
              <strong>{genData.display_name}</strong>
              {genData.architecture.name ? ` (${genData.architecture.name})` : ''}. Supports {tldrSupports} hardware encoding.
            </p>

            <div className="tldr-stats" id="tldr-stats">
              <div className="tldr-stats-grid">
                <div className="tldr-stat-card">
                  <div className="tldr-stat-label">Avg FPS</div>
                  <div className="tldr-stat-value" id="stat-fps">
                    {stats.avg_fps ? stats.avg_fps.toFixed(1) : '—'}
                  </div>
                  {fpsDiff !== null ? (
                    <div
                      className={`tldr-stat-diff ${fpsDiff > 0 ? 'positive' : fpsDiff < 0 ? 'negative' : ''}`}
                      id="stat-fps-diff"
                    >
                      {(fpsDiff >= 0 ? '+' : '') + fpsDiff}% vs 8th Gen
                    </div>
                  ) : (
                    <div className="tldr-stat-diff" id="stat-fps-diff" />
                  )}
                </div>
                <div className="tldr-stat-card">
                  <div className="tldr-stat-label">Efficiency</div>
                  <div className="tldr-stat-value" id="stat-efficiency">
                    {stats.fps_per_watt ? stats.fps_per_watt.toFixed(2) : '—'}
                    <span className="tldr-stat-unit"> FPS/W</span>
                  </div>
                  {effDiff !== null ? (
                    <div
                      className={`tldr-stat-diff ${effDiff > 0 ? 'positive' : effDiff < 0 ? 'negative' : ''}`}
                      id="stat-efficiency-diff"
                    >
                      {(effDiff >= 0 ? '+' : '') + effDiff}% vs 8th Gen
                    </div>
                  ) : (
                    <div className="tldr-stat-diff" id="stat-efficiency-diff" />
                  )}
                </div>
                <div className="tldr-stat-card">
                  <div className="tldr-stat-label">Avg Power</div>
                  <div className="tldr-stat-value" id="stat-watts">
                    {stats.avg_watts ? stats.avg_watts.toFixed(1) : '—'}
                    <span className="tldr-stat-unit">W</span>
                  </div>
                </div>
                <div className="tldr-stat-card">
                  <div className="tldr-stat-label">Results</div>
                  <div className="tldr-stat-value" id="stat-results">
                    {stats.total_results}
                  </div>
                  <div className="tldr-stat-sub" id="stat-cpus">
                    {stats.unique_cpus} CPUs
                  </div>
                </div>
              </div>

              <div className="tldr-comparison-charts" id="charts-container">
                <div className="tldr-chart-container">
                  <canvas id="gen-fps-chart" ref={charts.fpsRef} />
                </div>
                <div className="tldr-chart-container">
                  <canvas id="gen-watts-chart" ref={charts.wattsRef} />
                </div>
                <div className="tldr-chart-container">
                  <canvas id="gen-efficiency-chart" ref={charts.effRef} />
                </div>
              </div>

              {genId === '8' ? (
                <div id="baseline-note" className="tldr-baseline-note">
                  <span className="baseline-badge">Baseline</span>
                  8th Gen Coffee Lake is the reference baseline for all efficiency comparisons.
                </div>
              ) : null}
            </div>
          </section>

          <section className="card">
            <h2>Codec Support</h2>
            <div className="codec-matrix" id="codec-matrix">
              {codecs.map((c) => {
                const supported = !!genData.codec_support[c.key]
                return (
                  <div key={c.key} className={`codec-item ${supported ? 'supported' : 'unsupported'}`}>
                    <span className="codec-icon" style={{ color: supported ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                      {supported ? '✓' : '✗'}
                    </span>
                    <span>{c.name}</span>
                  </div>
                )
              })}
            </div>
          </section>

          {genData.arch_variants.length > 0 ? (
            <section id="arch-details-section" style={{ display: 'block' }}>
              <h2>Architecture Details</h2>
              <div className="arch-details-grid" id="arch-details-grid">
                {genData.has_multiple_variants ? (
                  <>
                    <div className="arch-variants-intro">
                      <span className="variant-badge">{genData.arch_variants.length} die variants</span>
                      <span className="variant-intro-text">
                        Different SKUs use different silicon with varying iGPU capabilities
                      </span>
                    </div>
                    <div className="arch-variants-grid">
                      {genData.arch_variants.map((variant) => (
                        <div key={variant.pattern} className="arch-variant-card">
                          <div className="arch-variant-header">
                            <span className="variant-codename">{variant.codename || 'Unknown'}</span>
                          </div>
                          <div className="arch-variant-details">
                            {variant.igpu_name ? (
                              <div className="variant-detail-row">
                                <span className="variant-detail-label">iGPU</span>
                                <span className="variant-detail-value">
                                  {variant.igpu_name}
                                  {variant.gpu_eu_count ? ` (${variant.gpu_eu_count})` : ''}
                                  <br />
                                  <span className="variant-detail-sublabel">
                                    {[variant.igpu_codename || '', variant.igpu_boost_mhz ? `${variant.igpu_boost_mhz} MHz boost` : '']
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                  {(() => {
                                    const tier = getIgpuTier(variant.gpu_eu_count)
                                    if (!tier) return null
                                    return <span className={`igpu-tier ${tier.className}`}>{tier.tier}</span>
                                  })()}
                                </span>
                              </div>
                            ) : null}

                            {variant.max_p_cores !== null && variant.max_p_cores !== undefined ? (
                              <div className="variant-detail-row">
                                <span className="variant-detail-label">Cores</span>
                                <span className="variant-detail-value">
                                  {variant.max_p_cores}P
                                  {variant.max_e_cores ? ` + ${variant.max_e_cores}E` : variant.max_e_cores === 0 ? ' only' : ''}
                                </span>
                              </div>
                            ) : null}

                            {variant.process_nm ? (
                              <div className="variant-detail-row">
                                <span className="variant-detail-label">Process</span>
                                <span className="variant-detail-value">
                                  {processExplainers[variant.process_nm] ? (
                                    <>
                                      <a
                                        href={processExplainers[variant.process_nm].url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="process-info-link"
                                        title={processExplainers[variant.process_nm].equiv}
                                      >
                                        {variant.process_nm}
                                      </a>
                                      <br />
                                      <span className="variant-detail-sublabel">
                                        {processExplainers[variant.process_nm].equiv}
                                      </span>
                                    </>
                                  ) : (
                                    variant.process_nm
                                  )}
                                </span>
                              </div>
                            ) : null}

                            {variant.tdp_range ? (
                              <div className="variant-detail-row">
                                <span className="variant-detail-label">TDP</span>
                                <span className="variant-detail-value">{variant.tdp_range}</span>
                              </div>
                            ) : null}

                            {variant.release_year ? (
                              <div className="variant-detail-row">
                                <span className="variant-detail-label">Released</span>
                                <span className="variant-detail-value">
                                  {variant.release_quarter ? `Q${variant.release_quarter} ` : ''}
                                  {variant.release_year}
                                </span>
                              </div>
                            ) : null}
                          </div>

                          <div className="variant-tested-cpus">
                            <div className="variant-tested-cpus-label">Tested CPUs</div>
                            {variant.tested_cpus.length === 0 ? (
                              <span className="cpu-badge cpu-badge-none">No samples</span>
                            ) : (
                              <>
                                {variant.tested_cpus.slice(0, 4).map((cpu) => (
                                  <span key={cpu} className="cpu-badge">
                                    {stripIntelBranding(cpu)}
                                  </span>
                                ))}
                                {variant.tested_cpus.length > 4 ? (
                                  <span className="cpu-badge cpu-badge-more">+{variant.tested_cpus.length - 4} more</span>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="arch-single-variant">
                    <div className="arch-variant-card">
                      <div className="arch-variant-header">
                        <span className="variant-codename">{genData.arch_variants[0].codename || genData.architecture.name || 'Unknown'}</span>
                      </div>
                      <div className="arch-variant-details">
                        {/* Reuse the multi variant renderer by delegating to the same markup */}
                        {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
                        {(() => {
                          const variant = genData.arch_variants[0]
                          const tier = getIgpuTier(variant.gpu_eu_count)
                          return (
                            <>
                              {variant.igpu_name ? (
                                <div className="variant-detail-row">
                                  <span className="variant-detail-label">iGPU</span>
                                  <span className="variant-detail-value">
                                    {variant.igpu_name}
                                    {variant.gpu_eu_count ? ` (${variant.gpu_eu_count})` : ''}
                                    <br />
                                    <span className="variant-detail-sublabel">
                                      {[variant.igpu_codename || '', variant.igpu_boost_mhz ? `${variant.igpu_boost_mhz} MHz boost` : '']
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </span>
                                    {tier ? <span className={`igpu-tier ${tier.className}`}>{tier.tier}</span> : null}
                                  </span>
                                </div>
                              ) : null}

                              {variant.max_p_cores !== null && variant.max_p_cores !== undefined ? (
                                <div className="variant-detail-row">
                                  <span className="variant-detail-label">Cores</span>
                                  <span className="variant-detail-value">
                                    {variant.max_p_cores}P
                                    {variant.max_e_cores ? ` + ${variant.max_e_cores}E` : variant.max_e_cores === 0 ? ' only' : ''}
                                  </span>
                                </div>
                              ) : null}

                              {variant.process_nm ? (
                                <div className="variant-detail-row">
                                  <span className="variant-detail-label">Process</span>
                                  <span className="variant-detail-value">
                                    {processExplainers[variant.process_nm] ? (
                                      <>
                                        <a
                                          href={processExplainers[variant.process_nm].url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="process-info-link"
                                          title={processExplainers[variant.process_nm].equiv}
                                        >
                                          {variant.process_nm}
                                        </a>
                                        <br />
                                        <span className="variant-detail-sublabel">
                                          {processExplainers[variant.process_nm].equiv}
                                        </span>
                                      </>
                                    ) : (
                                      variant.process_nm
                                    )}
                                  </span>
                                </div>
                              ) : null}

                              {variant.tdp_range ? (
                                <div className="variant-detail-row">
                                  <span className="variant-detail-label">TDP</span>
                                  <span className="variant-detail-value">{variant.tdp_range}</span>
                                </div>
                              ) : null}

                              {variant.release_year ? (
                                <div className="variant-detail-row">
                                  <span className="variant-detail-label">Released</span>
                                  <span className="variant-detail-value">
                                    {variant.release_quarter ? `Q${variant.release_quarter} ` : ''}
                                    {variant.release_year}
                                  </span>
                                </div>
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                      <div className="variant-tested-cpus">
                        <div className="variant-tested-cpus-label">Tested CPUs</div>
                        {genData.arch_variants[0].tested_cpus.length === 0 ? (
                          <span className="cpu-badge cpu-badge-none">No samples</span>
                        ) : (
                          <>
                            {genData.arch_variants[0].tested_cpus.slice(0, 4).map((cpu) => (
                              <span key={cpu} className="cpu-badge">
                                {stripIntelBranding(cpu)}
                              </span>
                            ))}
                            {genData.arch_variants[0].tested_cpus.length > 4 ? (
                              <span className="cpu-badge cpu-badge-more">+{genData.arch_variants[0].tested_cpus.length - 4} more</span>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {hasConcurrency ? (
            <div id="concurrency-section" className="concurrency-section">
              <div className="section-header">
                <h3>Concurrency Results</h3>
                <span className="section-subtitle">Maximum simultaneous streams at realtime speed (≥1.0x)</span>
              </div>
              <div className="concurrency-tables" id="concurrency-tables">
                {sortedConcurrencyTests.map((testName) => {
                  const cpuResults = Object.values(genData.concurrency_by_test[testName] || {})
                    .sort((a, b) => b.max_concurrency - a.max_concurrency)
                  return (
                    <div key={testName} className="concurrency-table-wrapper">
                      <h4>{testLabels[testName] || testName}</h4>
                      <table className="concurrency-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>CPU</th>
                            <th style={{ textAlign: 'right' }}>Max Streams</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cpuResults.map((r, i) => (
                            <tr key={r.cpu_raw}>
                              <td className="rank-cell">#{i + 1}</td>
                              <td className="cpu-cell">{stripIntelBranding(r.cpu_raw)}</td>
                              <td className="streams-cell">{r.max_concurrency}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <section className="benchmark-section card">
            <h2>
              Benchmark Data <span className="data-count" id="data-count">{`${stats.total_results} results from ${stats.unique_cpus} CPUs`}</span>
            </h2>
            <div className="test-stats" id="test-stats">
              <table>
                <thead>
                  <tr>
                    <th>Test</th>
                    <th className="numeric">Avg FPS</th>
                    <th className="numeric">Min</th>
                    <th className="numeric">Max</th>
                    <th className="numeric">FPS/Watt</th>
                  </tr>
                </thead>
                <tbody id="test-stats-body">
                  {stats.by_test.map((test) => (
                    <tr key={test.test_name}>
                      <td>
                        <span className={`test-badge ${testBadgeClass(test.test_name)}`}>{test.test_name}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{test.avg_fps ? test.avg_fps.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{test.min_fps ? test.min_fps.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{test.max_fps ? test.max_fps.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{test.fps_per_watt ? test.fps_per_watt.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="cpu-models-section card">
            <h2>CPUs in This Generation</h2>
            {winner ? (
              <div id="winner-callout" className="winner-callout" style={{ display: 'flex' }}>
                <span className="winner-badge">Top Performer</span>
                <span className="winner-name">{stripIntelBranding(winner.cpu_raw)}</span>
                <span className="winner-reason">
                  {(() => {
                    const parts: string[] = []
                    const second = cpuModelsWithScores[1]
                    if (winner.score && second?.score && winner.score > second.score) parts.push(`+${winner.score - second.score} points vs ${stripIntelBranding(second.cpu_raw)}`)
                    if (winner.fps_per_watt) parts.push(`${winner.fps_per_watt.toFixed(1)} FPS/W efficiency`)
                    if (winner.score) {
                      const label = winner.score >= 70 ? 'excellent' : winner.score >= 50 ? 'good' : 'moderate'
                      parts.push(`${label} overall (${winner.score}/100)`)
                    }
                    return parts.join(' • ')
                  })()}
                </span>
              </div>
            ) : null}

            <div className="cpu-grid" id="cpu-models-grid">
              <div className="cpu-grid-header">CPU Model</div>
              <div className="cpu-grid-header text-right">Score</div>
              <div className="cpu-grid-header text-right">Avg FPS</div>
              <div className="cpu-grid-header text-right">Avg Watts</div>
              <div className="cpu-grid-header text-right">FPS/Watt</div>
              <div className="cpu-grid-header text-right">Results</div>

              {cpuModelsWithScores.map((cpu) => {
                const hasWattsData = cpu.avg_watts > 0
                return (
                  <div key={cpu.cpu_raw} style={{ display: 'contents' }}>
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)' }}>
                      {stripIntelBranding(cpu.cpu_raw)}
                      {cpu.has_flagged ? (
                        <span title="Some results excluded from efficiency scoring due to data quality issues" style={{ cursor: 'help', color: '#ff9800' }}>
                          {' '}
                          ⚠️
                        </span>
                      ) : null}
                    </div>
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>
                      {cpu.score !== null ? <ScoreBadge score={cpu.score} /> : '—'}
                    </div>
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {cpu.avg_fps ? cpu.avg_fps.toFixed(1) : '—'}
                    </div>
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {hasWattsData ? cpu.avg_watts.toFixed(1) : '—'}
                    </div>
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {hasWattsData ? cpu.fps_per_watt.toFixed(2) : '—'}
                    </div>
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {cpu.result_count}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="pricing-section card" id="pricing-section">
            <h2>Find This CPU</h2>
            <p className="pricing-note" id="pricing-note">
              {prices.note}
            </p>
            <div className="pricing-links" id="pricing-links">
              {prices.links.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="pricing-link">
                  {l.label}
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
