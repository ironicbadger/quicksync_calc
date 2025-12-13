import { useMemo, useState } from 'react'
import { CpuNameLink } from '../../components/CpuNameLink'
import { ScoreBadge } from '../../components/ScoreBadge'
import { useBenchmarkData } from '../../app/BenchmarkDataProvider'
import { useDocumentTitle } from '../../layout/useDocumentTitle'
import { calculateOverallCpuScores } from '../../utils/quicksync'
import './styles.css'

export function LeaderboardPage() {
  useDocumentTitle('CPU Leaderboard - QuickSync Benchmarks')

  const { state } = useBenchmarkData()
  const [filterArch, setFilterArch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const INITIAL_COUNT = 20

  const scores = useMemo(() => {
    if (state.status !== 'ready') return null
    return calculateOverallCpuScores(state.data)
  }, [state])

  const architectures = useMemo(() => {
    if (!scores) return []
    return [...new Set(scores.map((s) => s.architecture).filter(Boolean) as string[])].sort()
  }, [scores])

  const filtered = useMemo(() => {
    if (!scores) return []
    if (!filterArch) return scores
    return scores.filter((s) => s.architecture === filterArch)
  }, [filterArch, scores])

  const visible = useMemo(() => {
    if (showAll) return filtered
    return filtered.slice(0, Math.min(INITIAL_COUNT, filtered.length))
  }, [filtered, showAll])

  return (
    <div className="page-leaderboard">
      <div className="container">
        <div className="page-header">
          <h1>CPU Leaderboard</h1>
          <p className="subtitle">Ranked by overall QuickSync performance score</p>
        </div>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="filter-arch">Architecture:</label>
          <select
            id="filter-arch"
            value={filterArch}
            onChange={(e) => {
              setFilterArch(e.target.value)
              setShowAll(false)
            }}
          >
            <option value="">All Architectures</option>
            {architectures.map((arch) => (
              <option key={arch} value={arch}>
                {arch}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="leaderboard-card">
        <table id="leaderboard-table">
          <colgroup>
            <col style={{ width: '60px' }} />
            <col style={{ width: '45%' }} />
            <col style={{ width: '35%' }} />
            <col style={{ width: '80px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>CPU</th>
              <th>Architecture</th>
              <th className="numeric">Score</th>
            </tr>
          </thead>
          <tbody id="leaderboard-body">
            {state.status !== 'ready' ? (
              <tr>
                <td colSpan={4} className="loading-cell">
                  Loading...
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="loading-cell">
                  No CPUs found
                </td>
              </tr>
            ) : (
              visible.map((cpu, idx) => {
                const rank = idx + 1
                const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other'
                return (
                  <tr key={cpu.cpu_raw}>
                    <td>
                      <span className={`rank-badge ${rankClass}`}>{rank}</span>
                    </td>
                    <td className="cpu-name">
                      <CpuNameLink cpuRaw={cpu.cpu_raw} architecture={cpu.architecture} generation={cpu.cpu_generation} />
                      {cpu.hasFlaggedResults ? (
                        <span
                          title="Some results excluded from efficiency scoring due to data quality issues"
                          style={{ cursor: 'help', color: '#ff9800' }}
                        >
                          {' '}
                          *
                        </span>
                      ) : null}
                    </td>
                    <td>{cpu.architecture || '-'}</td>
                    <td className="numeric">
                      <ScoreBadge score={cpu.score} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {state.status === 'ready' && filtered.length > INITIAL_COUNT ? (
          <div id="show-more-container" className="show-more-container">
            <button id="show-more-btn" className="show-more-btn" onClick={() => setShowAll((s) => !s)}>
              {showAll ? `Show Top ${INITIAL_COUNT}` : `Show All ${filtered.length} CPUs`}
            </button>
          </div>
        ) : null}
      </div>

        <div className="methodology-section">
          <h2>Scoring Methodology</h2>

        <div className="methodology-card">
          <h3>Overall Score (0-100)</h3>
          <p>
            Each CPU receives a composite score from 0-100 based on three weighted factors. Higher scores indicate
            better QuickSync hardware encoding performance.
          </p>
        </div>

        <div className="methodology-grid">
          <div className="methodology-card">
            <div className="weight-badge">40%</div>
            <h3>Performance</h3>
            <p>
              Percentile rank of average FPS across all benchmark tests. Measures raw encoding speed — how quickly the
              GPU can transcode video.
            </p>
          </div>

          <div className="methodology-card">
            <div className="weight-badge">35%</div>
            <h3>Efficiency</h3>
            <p>
              Percentile rank of FPS per watt consumed during encoding. Rewards CPUs that achieve high performance
              without excessive power draw.
            </p>
          </div>

          <div className="methodology-card">
            <div className="weight-badge">25%</div>
            <h3>Codec Support</h3>
            <p>
              Percentage of available test types completed. CPUs with broader codec support (H.264, HEVC 8-bit, HEVC
              10-bit, etc.) score higher.
            </p>
          </div>
        </div>

        <div className="methodology-card">
          <h3>Score Calculation</h3>
          <p>The final score is calculated as:</p>
          <code className="formula">Score = (Performance × 0.40) + (Efficiency × 0.35) + (Codec Support × 0.25)</code>
          <p>
            All sub-scores are normalized to 0-100 using percentile ranking against the entire database. This means
            scores are relative — as more CPUs are added, rankings may shift.
          </p>
        </div>

        <div className="methodology-card">
          <h3>Data Sources</h3>
          <p>
            Benchmark results come from community submissions running the{' '}
            <a href="https://github.com/ironicbadger/quicksync_calc">quicksync-benchmark.sh</a> script. Results include
            FPS, encoding speed, and power consumption (where available) across standardized test files and codec
            configurations.
          </p>
        </div>

        <div className="methodology-card">
          <h3>Data Quality</h3>
          <p>
            Efficiency scores exclude results with power readings below 3W (likely measurement errors) or efficiency
            above 400 fps/W (physically implausible). CPUs with excluded results are marked with an asterisk (*). Arrow
            Lake CPUs currently have a known power measurement issue with intel_gpu_top and are excluded from
            efficiency rankings until resolved.
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
