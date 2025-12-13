import { useCallback, useMemo, useState } from 'react'
import { CpuNameLink } from '../../components/CpuNameLink'
import { ScoreBadge } from '../../components/ScoreBadge'
import { TestBadge } from '../../components/TestBadge'
import { BoxplotMedianChart } from '../../components/charts/BoxplotMedianChart'
import { ConcurrencyChart } from '../../components/charts/ConcurrencyChart'
import { useBenchmarkData } from '../../app/BenchmarkDataProvider'
import type { BenchmarkResult } from '../../app/types'
import { useDocumentTitle } from '../../layout/useDocumentTitle'
import {
  EMPTY_FILTERS,
  calculateOverallCpuScoreMap,
  computeBoxplotData,
  computeFilterCounts,
  computeFilterOptions,
  filterResults,
  formatGeneration,
  stripIntelBranding,
  type Filters,
} from '../../utils/quicksync'
import './styles.css'

type SortColumn =
  | 'cpu_raw'
  | 'architecture'
  | 'test_name'
  | 'avg_fps'
  | 'avg_watts'
  | 'fps_per_watt'
  | 'avg_speed'
  | 'score'
  | 'submitted_at'

type SortState = { column: SortColumn; order: 'asc' | 'desc' }

function toggleInArray<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

function formatQualityFlags(flags: string[] | undefined) {
  if (!flags || flags.length === 0) return null
  const messages: Record<string, string> = {
    power_too_low: 'Power reading < 3W (likely measurement error)',
    efficiency_outlier: 'Efficiency > 400 fps/W (outlier)',
    arrow_lake_power_issue: 'Arrow Lake: Known power measurement issue with intel_gpu_top',
  }
  return flags.map((f) => messages[f] || f).join('; ')
}

function InfoBanner() {
  const [hidden, setHidden] = useState(() => localStorage.getItem('quicksync-banner-hidden') === 'true')

  const hide = useCallback(() => {
    localStorage.setItem('quicksync-banner-hidden', 'true')
    setHidden(true)
  }, [])

  const show = useCallback(() => {
    localStorage.removeItem('quicksync-banner-hidden')
    setHidden(false)
  }, [])

  return (
    <>
      {!hidden ? (
        <div id="info-banner" className="info-banner">
          <div className="info-banner-content">
            <div className="info-banner-main">
              <div className="info-section">
                <h2>Intel Quick Sync Video Benchmarks</h2>
                <p>
                  Community-driven database of hardware transcoding performance. Compare FPS, power usage, and efficiency
                  across Intel CPU generations for Plex/Jellyfin transcoding.
                </p>
                <br />
                <p>
                  Brought to you by{' '}
                  <a href="https://github.com/ironicbadger" target="_blank" rel="noopener noreferrer">
                    ironicbadger
                  </a>{' '}
                  and{' '}
                  <a href="https://github.com/cptmorgan-rh" target="_blank" rel="noopener noreferrer">
                    cptmorgan
                  </a>
                  .
                </p>
              </div>
              <div className="info-section">
                <h3>How to Use</h3>
                <ul>
                  <li>
                    <strong>Filter:</strong> Use the sidebar to filter by CPU model, generation, or test type
                  </li>
                  <li>
                    <strong>Click charts:</strong> Click any bar to filter by that generation
                  </li>
                  <li>
                    <strong>Compare:</strong> Select a generation to see detailed stats vs 8th Gen baseline
                  </li>
                </ul>
              </div>
              <div className="info-section">
                <h3>Submit Your Results</h3>
                <pre>
                  <code>{`git clone https://github.com/ironicbadger/quicksync_calc.git\ncd quicksync_calc\n./quicksync-benchmark.sh --concurrency`}</code>
                </pre>
                <p className="info-note">
                  After benchmarks complete, you&apos;ll get a link to verify and submit your results. Requires Docker +
                  Intel CPU with Quick Sync. <a href="/about">Full instructions</a>
                </p>
              </div>
            </div>
            <button id="hide-banner" className="hide-banner-btn" title="Hide this banner" onClick={hide}>
              <span className="hide-icon">×</span>
            </button>
          </div>
        </div>
      ) : null}

      {hidden ? (
        <button id="show-banner" className="show-banner-btn" onClick={show}>
          <span>?</span> Info &amp; Submit
        </button>
      ) : null}
    </>
  )
}

export function HomePage() {
  useDocumentTitle('QuickSync Benchmarks - Intel Quick Sync Video Performance')

  const { state } = useBenchmarkData()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [cpuSearch, setCpuSearch] = useState('')
  const [submitterSearch, setSubmitterSearch] = useState('')
  const [sort, setSort] = useState<SortState>({ column: 'submitted_at', order: 'desc' })
  const [pagination, setPagination] = useState({ limit: 100, offset: 0 })

  const readyData = state.status === 'ready' ? state.data : null

  const filterOptions = useMemo(() => (readyData ? computeFilterOptions(readyData) : { generations: [], architectures: [], tests: [] }), [readyData])

  const cpuScores = useMemo(() => (readyData ? calculateOverallCpuScoreMap(readyData) : {}), [readyData])

  const filteredResults = useMemo(() => (readyData ? filterResults(readyData, filters) : []), [filters, readyData])
  const filterCounts = useMemo(() => (readyData ? computeFilterCounts(readyData, filteredResults) : null), [filteredResults, readyData])

  const displayedResults = useMemo(() => {
    if (!readyData) return { total: 0, page: 1, totalPages: 1, rows: [] as BenchmarkResult[] }

    const total = filteredResults.length
    const totalPages = Math.max(1, Math.ceil(total / pagination.limit))
    const page = Math.floor(pagination.offset / pagination.limit) + 1

    const sorted = [...filteredResults].sort((a, b) => {
      const sortCol = sort.column
      const sortOrder = sort.order

      let aVal: unknown
      let bVal: unknown

      if (sortCol === 'score') {
        aVal = cpuScores[a.cpu_raw] ?? -1
        bVal = cpuScores[b.cpu_raw] ?? -1
      } else {
        aVal = a[sortCol]
        bVal = b[sortCol]
      }

      if (aVal === null || aVal === undefined) aVal = sortOrder === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
      if (bVal === null || bVal === undefined) bVal = sortOrder === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      const aNum = typeof aVal === 'number' ? aVal : Number(aVal)
      const bNum = typeof bVal === 'number' ? bVal : Number(bVal)
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum
    })

    const start = pagination.offset
    const end = start + pagination.limit
    return { total, page, totalPages, rows: sorted.slice(start, end) }
  }, [cpuScores, filteredResults, pagination.limit, pagination.offset, readyData, sort.column, sort.order])

  const toggleFilter = useCallback((filterType: keyof Filters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (filterType === 'ecc') {
        next.ecc = toggleInArray(prev.ecc, value as 'yes' | 'no')
      } else {
        next[filterType] = toggleInArray(prev[filterType] as string[], value) as never
      }
      return next
    })
    setPagination((p) => ({ ...p, offset: 0 }))
  }, [])

  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setPagination((p) => ({ ...p, offset: 0 }))
  }, [])

  const cpuEntries = useMemo(() => {
    if (!filterCounts) return []
    const searchLower = cpuSearch.trim().toLowerCase()

    const entries = Object.entries(filterCounts.cpus)
      .filter(([cpu]) => {
        if (!searchLower) return true
        return cpu.toLowerCase().includes(searchLower) || stripIntelBranding(cpu).toLowerCase().includes(searchLower)
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)

    return entries
  }, [cpuSearch, filterCounts])

  const submitterEntries = useMemo(() => {
    if (!filterCounts) return []
    const searchLower = submitterSearch.trim().toLowerCase()
    return Object.entries(filterCounts.submitters)
      .filter(([submitter]) => submitter.toLowerCase().includes(searchLower))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
  }, [filterCounts, submitterSearch])

  const boxplot = useMemo(() => {
    if (!readyData) return null
    return {
      avg_fps: computeBoxplotData(readyData, 'avg_fps', filters.test),
      avg_watts: computeBoxplotData(readyData, 'avg_watts', filters.test),
      fps_per_watt: computeBoxplotData(readyData, 'fps_per_watt', filters.test),
    }
  }, [filters.test, readyData])

  const concurrencyLeaderboards = useMemo(() => {
    if (!readyData?.concurrencyResults?.length) return null

    const concurrencyResults = readyData.concurrencyResults

    function topByTest(testName: string, limit = 5) {
      const results = concurrencyResults.filter((r) => r.test_name === testName)
      const bestByCpu: Record<string, (typeof results)[number]> = {}
      for (const r of results) {
        const current = bestByCpu[r.cpu_raw]
        if (!current || r.max_concurrency > current.max_concurrency) bestByCpu[r.cpu_raw] = r
      }
      return Object.values(bestByCpu)
        .sort((a, b) => b.max_concurrency - a.max_concurrency)
        .slice(0, limit)
    }

    return {
      h264_1080p: topByTest('h264_1080p'),
      h264_4k: topByTest('h264_4k'),
      hevc_8bit: topByTest('hevc_8bit'),
      hevc_4k_10bit: topByTest('hevc_4k_10bit'),
    }
  }, [readyData])

  const onSort = useCallback((column: SortColumn) => {
    setSort((prev) => {
      if (prev.column === column) return { column, order: prev.order === 'asc' ? 'desc' : 'asc' }
      return { column, order: 'desc' }
    })
    setPagination((p) => ({ ...p, offset: 0 }))
  }, [])

  const setLimit = useCallback((limit: number) => {
    setPagination({ limit, offset: 0 })
  }, [])

  const prevPage = useCallback(() => {
    setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))
  }, [])

  const nextPage = useCallback(() => {
    setPagination((p) => ({ ...p, offset: p.offset + p.limit }))
  }, [])

  const totalResults = readyData?.meta.totalResults?.toLocaleString() ?? '-'
  const uniqueCpus = readyData?.meta.uniqueCpus?.toLocaleString() ?? '-'
  const architecturesCount = readyData?.meta.architecturesCount?.toLocaleString() ?? '-'
  const filteredCount = readyData ? displayedResults.total.toLocaleString() : '-'

  const hasConcurrency = !!(readyData?.concurrencyResults && readyData.concurrencyResults.length > 0)

  return (
    <div className="page-home">
      <InfoBanner />

      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Filters</h2>
            <button id="clear-filters" className="btn-link" onClick={clearAll}>
              Clear All
            </button>
          </div>

          <div className="filter-section">
            <h3>Submitter ID</h3>
            <input
              type="text"
              id="submitter-search"
              placeholder="Search submitters..."
              className="search-input"
              value={submitterSearch}
              onChange={(e) => setSubmitterSearch(e.target.value)}
            />
            <div id="submitter-list" className="checkbox-list submitter-list">
              {state.status !== 'ready' ? null : submitterEntries.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
                  No submitters found
                </div>
              ) : (
                submitterEntries.map(([submitter, count]) => {
                  const displayText = submitter.length > 20 ? `${submitter.slice(0, 20)}...` : submitter
                  const checked = filters.submitter.includes(submitter)
                  return (
                    <label key={submitter} className="checkbox-item" data-value={submitter}>
                      <input
                        type="checkbox"
                        value={submitter}
                        data-filter="submitter"
                        checked={checked}
                        onChange={() => toggleFilter('submitter', submitter)}
                      />
                      <span title={submitter}>{displayText}</span>
                      <span className="count">({count})</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div className="filter-section">
            <h3>CPU Model</h3>
            <input
              type="text"
              id="cpu-search"
              placeholder="Search CPUs..."
              className="search-input"
              value={cpuSearch}
              onChange={(e) => setCpuSearch(e.target.value)}
            />
            <div id="cpu-list" className="checkbox-list cpu-list">
              {state.status !== 'ready' ? null : cpuEntries.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
                  No CPUs match current filters
                </div>
              ) : (
                cpuEntries.map(([cpu, count]) => {
                  const displayName = stripIntelBranding(cpu)
                  const displayText = displayName.length > 22 ? `${displayName.slice(0, 22)}...` : displayName
                  const checked = filters.cpu.includes(cpu)
                  return (
                    <label key={cpu} className="checkbox-item" data-value={cpu}>
                      <input type="checkbox" value={cpu} data-filter="cpu" checked={checked} onChange={() => toggleFilter('cpu', cpu)} />
                      <span title={cpu}>{displayText}</span>
                      <span className="count">({count})</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div className="filter-section">
            <h3>Generation</h3>
            <div id="generation-list" className="checkbox-list">
              {state.status !== 'ready'
                ? null
                : filterOptions.generations.map((gen) => {
                    const count = filterCounts?.generations[gen] || 0
                    const selected = filters.generation.includes(gen)
                    const disabled = count === 0 && !selected
                    return (
                      <label key={gen} className={`checkbox-item${disabled ? ' disabled' : ''}`} data-value={gen}>
                        <input
                          type="checkbox"
                          value={gen}
                          data-filter="generation"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => toggleFilter('generation', gen)}
                        />
                        <span>{formatGeneration(gen)}</span>
                        <span className="count">({count})</span>
                      </label>
                    )
                  })}
            </div>
          </div>

          <div className="filter-section">
            <h3>Architecture</h3>
            <div id="architecture-list" className="checkbox-list">
              {state.status !== 'ready'
                ? null
                : filterOptions.architectures.map((arch) => {
                    const count = filterCounts?.architectures[arch] || 0
                    const selected = filters.architecture.includes(arch)
                    const disabled = count === 0 && !selected
                    return (
                      <label key={arch} className={`checkbox-item${disabled ? ' disabled' : ''}`} data-value={arch}>
                        <input
                          type="checkbox"
                          value={arch}
                          data-filter="architecture"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => toggleFilter('architecture', arch)}
                        />
                        <span>{arch}</span>
                        <span className="count">({count})</span>
                      </label>
                    )
                  })}
            </div>
          </div>

          <div className="filter-section">
            <h3>Test Type</h3>
            <div id="test-list" className="checkbox-list">
              {state.status !== 'ready'
                ? null
                : filterOptions.tests.map((test) => {
                    const count = filterCounts?.tests[test] || 0
                    const selected = filters.test.includes(test)
                    const disabled = count === 0 && !selected
                    return (
                      <label key={test} className={`checkbox-item${disabled ? ' disabled' : ''}`} data-value={test}>
                        <input type="checkbox" value={test} data-filter="test" checked={selected} disabled={disabled} onChange={() => toggleFilter('test', test)} />
                        <span>{test}</span>
                        <span className="count">({count})</span>
                      </label>
                    )
                  })}
            </div>
          </div>

          <div className="filter-section">
            <h3>ECC Support</h3>
            <div id="ecc-list" className="checkbox-list">
              <label className="checkbox-item" data-value="yes">
                <input type="checkbox" value="yes" data-filter="ecc" checked={filters.ecc.includes('yes')} onChange={() => toggleFilter('ecc', 'yes')} />
                <span>ECC Supported</span>
                <span className="count" id="ecc-yes-count">
                  ({filterCounts?.ecc.yes || 0})
                </span>
              </label>
              <label className="checkbox-item" data-value="no">
                <input type="checkbox" value="no" data-filter="ecc" checked={filters.ecc.includes('no')} onChange={() => toggleFilter('ecc', 'no')} />
                <span>No ECC</span>
                <span className="count" id="ecc-no-count">
                  ({filterCounts?.ecc.no || 0})
                </span>
              </label>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <div className="summary-cards">
            <div className="card summary-card">
              <div className="summary-value" id="total-results">
                {totalResults}
              </div>
              <div className="summary-label">Total Results</div>
            </div>
            <div className="card summary-card">
              <div className="summary-value" id="unique-cpus">
                {uniqueCpus}
              </div>
              <div className="summary-label">Unique CPUs</div>
            </div>
            <div className="card summary-card">
              <div className="summary-value" id="filtered-results">
                {filteredCount}
              </div>
              <div className="summary-label">Filtered Results</div>
            </div>
            <div className="card summary-card">
              <div className="summary-value" id="architectures-count">
                {architecturesCount}
              </div>
              <div className="summary-label">Architectures</div>
            </div>
          </div>

          <div className="charts-grid">
            {state.status === 'ready' && boxplot ? (
              <>
                <BoxplotMedianChart
                  id="fps-chart"
                  title="Average FPS by Generation"
                  metric="avg_fps"
                  points={boxplot.avg_fps}
                  selectedGenerationFilters={filters.generation}
                  onToggleGeneration={(g) => toggleFilter('generation', g)}
                  yLabel="Frames per Second"
                />
                <BoxplotMedianChart
                  id="watts-chart"
                  title="Power Usage by Generation"
                  metric="avg_watts"
                  points={boxplot.avg_watts}
                  selectedGenerationFilters={filters.generation}
                  onToggleGeneration={(g) => toggleFilter('generation', g)}
                  yLabel="Watts"
                />
                <BoxplotMedianChart
                  id="efficiency-chart"
                  title="Efficiency (FPS/Watt) by Generation"
                  metric="fps_per_watt"
                  points={boxplot.fps_per_watt}
                  selectedGenerationFilters={filters.generation}
                  onToggleGeneration={(g) => toggleFilter('generation', g)}
                  yLabel="FPS per Watt"
                />
                {hasConcurrency && readyData ? <ConcurrencyChart concurrencyResults={readyData.concurrencyResults} /> : null}
              </>
            ) : (
              <>
                <div className="chart-container card" />
                <div className="chart-container card" />
                <div className="chart-container card" />
                <div className="chart-container card" />
              </>
            )}
          </div>

          {hasConcurrency && concurrencyLeaderboards ? (
            <div id="concurrency-section" className="concurrency-section">
              <div className="section-header">
                <h3>Concurrency Leaderboard</h3>
                <span className="section-subtitle">Maximum simultaneous streams at realtime speed (≥1.0x)</span>
              </div>
              <div className="concurrency-tables">
                <div className="concurrency-table-wrapper">
                  <h4>H.264 1080p</h4>
                  <table id="h264-1080p-concurrency-table" className="concurrency-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>CPU</th>
                        <th>Max Streams</th>
                      </tr>
                    </thead>
                    <tbody>
                      {concurrencyLeaderboards.h264_1080p.map((r, i) => (
                        <tr key={r.cpu_raw}>
                          <td className="rank-cell">#{i + 1}</td>
                          <td className="cpu-cell">
                            <CpuNameLink cpuRaw={r.cpu_raw} architecture={r.architecture} generation={r.cpu_generation} />
                          </td>
                          <td className="streams-cell">{r.max_concurrency}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="concurrency-table-wrapper">
                  <h4>H.264 4K</h4>
                  <table id="h264-4k-concurrency-table" className="concurrency-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>CPU</th>
                        <th>Max Streams</th>
                      </tr>
                    </thead>
                    <tbody>
                      {concurrencyLeaderboards.h264_4k.map((r, i) => (
                        <tr key={r.cpu_raw}>
                          <td className="rank-cell">#{i + 1}</td>
                          <td className="cpu-cell">
                            <CpuNameLink cpuRaw={r.cpu_raw} architecture={r.architecture} generation={r.cpu_generation} />
                          </td>
                          <td className="streams-cell">{r.max_concurrency}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="concurrency-table-wrapper">
                  <h4>HEVC 1080p</h4>
                  <table id="hevc-8bit-concurrency-table" className="concurrency-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>CPU</th>
                        <th>Max Streams</th>
                      </tr>
                    </thead>
                    <tbody>
                      {concurrencyLeaderboards.hevc_8bit.map((r, i) => (
                        <tr key={r.cpu_raw}>
                          <td className="rank-cell">#{i + 1}</td>
                          <td className="cpu-cell">
                            <CpuNameLink cpuRaw={r.cpu_raw} architecture={r.architecture} generation={r.cpu_generation} />
                          </td>
                          <td className="streams-cell">{r.max_concurrency}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="concurrency-table-wrapper">
                  <h4>HEVC 4K 10-bit</h4>
                  <table id="hevc-4k-10bit-concurrency-table" className="concurrency-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>CPU</th>
                        <th>Max Streams</th>
                      </tr>
                    </thead>
                    <tbody>
                      {concurrencyLeaderboards.hevc_4k_10bit.map((r, i) => (
                        <tr key={r.cpu_raw}>
                          <td className="rank-cell">#{i + 1}</td>
                          <td className="cpu-cell">
                            <CpuNameLink cpuRaw={r.cpu_raw} architecture={r.architecture} generation={r.cpu_generation} />
                          </td>
                          <td className="streams-cell">{r.max_concurrency}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          <div className="results-table-wrapper card">
            <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>
                Results{' '}
                <span id="results-count">
                  {readyData ? `(${displayedResults.total.toLocaleString()} results)` : '(loading...)'}
                </span>
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label htmlFor="results-limit" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Show:
                </label>
                <select id="results-limit" value={pagination.limit} onChange={(e) => setLimit(Number.parseInt(e.target.value, 10))}>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                </select>
              </div>
            </div>

            <div className="table-scroll">
              <table id="results-table">
                <thead>
                  <tr>
                    <th
                      data-sort="cpu_raw"
                      className={sort.column === 'cpu_raw' ? (sort.order === 'asc' ? 'sorted-asc' : 'sorted-desc') : undefined}
                      onClick={() => onSort('cpu_raw')}
                    >
                      CPU
                    </th>
                    <th
                      data-sort="architecture"
                      className={sort.column === 'architecture' ? (sort.order === 'asc' ? 'sorted-asc' : 'sorted-desc') : undefined}
                      onClick={() => onSort('architecture')}
                    >
                      Architecture
                    </th>
                    <th
                      data-sort="test_name"
                      className={sort.column === 'test_name' ? (sort.order === 'asc' ? 'sorted-asc' : 'sorted-desc') : undefined}
                      onClick={() => onSort('test_name')}
                    >
                      Test
                    </th>
                    <th
                      data-sort="avg_fps"
                      className={`numeric ${sort.column === 'avg_fps' ? (sort.order === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}`}
                      onClick={() => onSort('avg_fps')}
                    >
                      FPS
                    </th>
                    <th
                      data-sort="avg_watts"
                      className={`numeric ${sort.column === 'avg_watts' ? (sort.order === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}`}
                      onClick={() => onSort('avg_watts')}
                    >
                      Watts
                    </th>
                    <th
                      data-sort="fps_per_watt"
                      className={`numeric ${sort.column === 'fps_per_watt' ? (sort.order === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}`}
                      onClick={() => onSort('fps_per_watt')}
                    >
                      FPS/Watt
                    </th>
                    <th
                      data-sort="avg_speed"
                      className={`numeric ${sort.column === 'avg_speed' ? (sort.order === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}`}
                      onClick={() => onSort('avg_speed')}
                    >
                      Speed
                    </th>
                    <th
                      data-sort="score"
                      className={`numeric ${sort.column === 'score' ? (sort.order === 'asc' ? 'sorted-asc' : 'sorted-desc') : ''}`}
                      onClick={() => onSort('score')}
                    >
                      Score
                    </th>
                    <th
                      data-sort="submitted_at"
                      className={sort.column === 'submitted_at' ? (sort.order === 'asc' ? 'sorted-asc' : 'sorted-desc') : undefined}
                      onClick={() => onSort('submitted_at')}
                    >
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody id="results-body">
                  {state.status !== 'ready' ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        Loading...
                      </td>
                    </tr>
                  ) : displayedResults.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        No results found
                      </td>
                    </tr>
                  ) : (
                    displayedResults.rows.map((r) => {
                      const score = cpuScores[r.cpu_raw]
                      const warningTitle = formatQualityFlags(r.data_quality_flags)
                      const date = new Date(r.submitted_at).toLocaleDateString()
                      return (
                        <tr key={`${r.id}`}>
                          <td className="cpu-cell">
                            <CpuNameLink cpuRaw={r.cpu_raw} architecture={r.architecture} generation={r.cpu_generation} />
                            {warningTitle ? (
                              <span className="quality-warning" title={warningTitle}>
                                ⚠️
                              </span>
                            ) : null}
                          </td>
                          <td>{r.architecture || '-'}</td>
                          <td>
                            <TestBadge testName={r.test_name} />
                          </td>
                          <td className="numeric">{Number.isFinite(r.avg_fps) ? r.avg_fps.toFixed(1) : '-'}</td>
                          <td className="numeric">{r.avg_watts !== null ? r.avg_watts.toFixed(1) : '-'}</td>
                          <td className="numeric">{r.fps_per_watt !== null ? r.fps_per_watt.toFixed(2) : '-'}</td>
                          <td className="numeric">{r.avg_speed !== null ? `${r.avg_speed.toFixed(2)}x` : '-'}</td>
                          <td className="numeric">{typeof score === 'number' ? <ScoreBadge score={score} /> : '-'}</td>
                          <td>{date}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <button id="prev-page" className="btn-secondary" disabled={state.status !== 'ready' || pagination.offset === 0} onClick={prevPage}>
                &larr; Previous
              </button>
              <span id="page-info" style={{ padding: '0.5rem 1rem', color: 'var(--color-text-muted)' }}>
                Page {displayedResults.page} of {displayedResults.totalPages}
              </span>
              <button
                id="next-page"
                className="btn-secondary"
                disabled={state.status !== 'ready' || pagination.offset + pagination.limit >= displayedResults.total}
                onClick={nextPage}
              >
                Next &rarr;
              </button>
            </div>
          </div>

          {state.status === 'error' ? (
            <div className="container" style={{ marginTop: '1rem', color: '#ef4444' }}>
              Failed to load benchmark data: {state.error.message}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}
