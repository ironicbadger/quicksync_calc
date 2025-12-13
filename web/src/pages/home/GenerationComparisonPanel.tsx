import { useMemo } from 'react'
import { ComparisonBarChart } from '../../components/charts/ComparisonBarChart'
import { formatGeneration, ordinal } from '../../utils/quicksync'
import type { ComparisonMetric, GenerationComparisonData } from '../../utils/comparisons'

const DEFAULT_COLORS = { bg: 'rgba(59, 130, 246, 0.7)', border: 'rgb(59, 130, 246)' }

const GEN_COLORS: Record<string, { bg: string; border: string }> = {
  '6': { bg: 'rgba(220, 38, 38, 0.8)', border: 'rgb(220, 38, 38)' },
  '7': { bg: 'rgba(234, 88, 12, 0.8)', border: 'rgb(234, 88, 12)' },
  '8': { bg: 'rgba(120, 120, 130, 0.6)', border: 'rgb(120, 120, 130)' },
  '9': { bg: 'rgba(202, 138, 4, 0.8)', border: 'rgb(202, 138, 4)' },
  '10': { bg: 'rgba(22, 163, 74, 0.8)', border: 'rgb(22, 163, 74)' },
  '11': { bg: 'rgba(20, 184, 166, 0.8)', border: 'rgb(20, 184, 166)' },
  '12': { bg: 'rgba(6, 182, 212, 0.8)', border: 'rgb(6, 182, 212)' },
  '13': { bg: 'rgba(59, 130, 246, 0.85)', border: 'rgb(59, 130, 246)' },
  '14': { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' },
  'ultra-1': { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)' },
  'ultra-2': { bg: 'rgba(139, 92, 246, 0.8)', border: 'rgb(139, 92, 246)' },
}

const ARC_COLORS = { bg: 'rgba(16, 185, 129, 0.7)', border: 'rgb(16, 185, 129)' }

function diffBadge(val: number | null | undefined, baseline: number | null | undefined) {
  if (!baseline || baseline === 0 || val === null || val === undefined) return null
  const diff = ((val - baseline) / baseline) * 100
  const cls = diff >= 0 ? 'positive' : 'negative'
  return (
    <span className={`gen-diff ${cls}`}>
      {diff >= 0 ? '+' : ''}
      {diff.toFixed(0)}%
    </span>
  )
}

function titleFor(comparison: GenerationComparisonData): string {
  const hasArc = comparison.groups.some((g) => g.isArc)
  const numericGens = comparison.numeric_generations
  const hasNumeric = numericGens.length > 0

  const virtualSelected = comparison.groups.some((g) => g.generation === 'ultra-1' || g.generation === 'ultra-2')
  const arcOnly = comparison.groups.length === 1 && comparison.groups[0].isArc

  if (arcOnly) return 'Intel Arc vs 8th Gen Baseline'

  if (!virtualSelected && hasNumeric && !hasArc) {
    const genList = numericGens.map((g) => ordinal(g)).join(', ')
    return numericGens.length === 1 ? `${genList} Gen vs 8th Gen Baseline` : `${genList} Gen Comparison`
  }

  if (!virtualSelected && hasNumeric && hasArc) {
    const genList = numericGens.map((g) => ordinal(g)).join(', ')
    return `${genList} Gen + Arc Comparison`
  }

  if (comparison.groups.length === 1) {
    const g = comparison.groups[0]
    const label = g.isArc ? 'Intel Arc' : formatGeneration(g.generation)
    return `${label} vs 8th Gen Baseline`
  }

  const labels = comparison.groups.map((g) => (g.isArc ? 'Arc' : formatGeneration(g.generation)))
  return `${labels.join(' + ')} Comparison`
}

export function GenerationComparisonPanel({ comparison }: { comparison: GenerationComparisonData }) {
  const hasArc = comparison.groups.some((g) => g.isArc)
  const hasNumeric = comparison.numeric_generations.length > 0
  const showGpuLabel = hasArc && !hasNumeric && comparison.groups.every((g) => g.isArc)

  const totalResults = comparison.groups.reduce((sum, g) => sum + g.overall.total_results, 0)
  const totalUniqueCpus = comparison.groups.reduce((sum, g) => sum + g.overall.unique_cpus, 0)

  const baselineFps = comparison.baseline_overall?.avg_fps ?? 0
  const baselineWatts = comparison.baseline_overall?.avg_watts ?? null
  const baselineEff = comparison.baseline_overall?.fps_per_watt ?? null

  const includes8 = comparison.numeric_generations.includes(8)

  function buildDatasets(metric: ComparisonMetric) {
    const datasets = comparison.groups.map((g) => {
      const colors = g.isArc ? ARC_COLORS : (GEN_COLORS[g.generation] ?? DEFAULT_COLORS)
      const label = g.isArc ? (g.architecture ?? 'Arc') : formatGeneration(g.generation)
      const data = comparison.all_tests.map((testName) => {
        const testInfo = g.by_test.find((t) => t.test_name === testName)
        const raw = testInfo ? testInfo[metric] : null
        return typeof raw === 'number' ? raw : 0
      })
      return { label, data, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }
    })

    if (!includes8) {
      const colors = GEN_COLORS['8'] ?? DEFAULT_COLORS
      datasets.push({
        label: '8th Gen (Baseline)',
        data: comparison.all_tests.map((testName) => {
          const testInfo = comparison.baseline_by_test.find((t) => t.test_name === testName)
          const raw = testInfo ? testInfo[metric] : null
          return typeof raw === 'number' ? raw : 0
        }),
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 1,
      })
    }

    return datasets
  }

  const fpsDatasets = useMemo(() => buildDatasets('avg_fps'), [comparison.all_tests, comparison.baseline_by_test, comparison.groups, includes8])
  const wattsDatasets = useMemo(() => buildDatasets('avg_watts'), [comparison.all_tests, comparison.baseline_by_test, comparison.groups, includes8])
  const efficiencyDatasets = useMemo(() => buildDatasets('fps_per_watt'), [comparison.all_tests, comparison.baseline_by_test, comparison.groups, includes8])

  const fpsTooltip = useMemo(
    () => ({ baseline_by_test: comparison.baseline_by_test, metric: 'avg_fps' as const }),
    [comparison.baseline_by_test],
  )
  const wattsTooltip = useMemo(
    () => ({ baseline_by_test: comparison.baseline_by_test, metric: 'avg_watts' as const }),
    [comparison.baseline_by_test],
  )
  const efficiencyTooltip = useMemo(
    () => ({ baseline_by_test: comparison.baseline_by_test, metric: 'fps_per_watt' as const }),
    [comparison.baseline_by_test],
  )

  return (
    <div id="generation-stats" className="generation-stats">
      <div className="gen-stats-header">
        <h3 id="gen-stats-title">{titleFor(comparison)}</h3>
        <span id="gen-stats-subtitle" className="gen-stats-subtitle">
          {totalResults} results from {totalUniqueCpus} unique {showGpuLabel ? 'GPUs' : 'CPUs'}
        </span>
      </div>

      <div className="gen-stats-content">
        <div id="gen-stats-summary" className="gen-stats-summary">
          <table className="gen-comparison-table">
            <thead>
              <tr>
                <th>Generation</th>
                <th>Avg FPS</th>
                <th>Avg Watts</th>
                <th>Efficiency</th>
                <th>Results</th>
              </tr>
            </thead>
            <tbody>
              {comparison.groups.map((g) => {
                const colors = g.isArc ? ARC_COLORS : (GEN_COLORS[g.generation] ?? DEFAULT_COLORS)
                const displayName = g.isArc ? (g.architecture ?? 'Arc') : formatGeneration(g.generation)
                const archLabel = !g.isArc && g.architecture ? <span className="gen-arch">{g.architecture}</span> : null
                const unitLabel = g.isArc ? 'GPUs' : 'CPUs'

                return (
                  <tr key={`${g.generation}-${g.architecture ?? ''}`} className="gen-row">
                    <td className="gen-name">
                      <span className="gen-indicator" style={{ background: colors.border }} />
                      <strong>{displayName}</strong>
                      {archLabel}
                    </td>
                    <td className="gen-metric">
                      <span className="gen-value">{Number.isFinite(g.overall.avg_fps) ? g.overall.avg_fps.toFixed(1) : '-'}</span>
                      {diffBadge(g.overall.avg_fps, baselineFps)}
                    </td>
                    <td className="gen-metric">
                      <span className="gen-value">{g.overall.avg_watts !== null ? g.overall.avg_watts.toFixed(1) : '-'}</span>
                      {g.overall.avg_watts !== null ? diffBadge(baselineWatts, g.overall.avg_watts) : null}
                    </td>
                    <td className="gen-metric">
                      <span className="gen-value">{g.overall.fps_per_watt !== null ? g.overall.fps_per_watt.toFixed(1) : '-'}</span>
                      {diffBadge(g.overall.fps_per_watt, baselineEff)}
                    </td>
                    <td className="gen-metric-small">
                      {g.overall.total_results} <span className="gen-muted">({g.overall.unique_cpus} {unitLabel})</span>
                    </td>
                  </tr>
                )
              })}

              {!includes8 ? (
                <tr className="gen-row baseline-row">
                  <td className="gen-name">
                    <span className="gen-indicator" style={{ background: (GEN_COLORS['8'] ?? DEFAULT_COLORS).border }} />
                    <strong>8th Gen</strong>
                    <span className="gen-arch baseline-tag">Baseline</span>
                  </td>
                  <td className="gen-metric">
                    <span className="gen-value">{baselineFps.toFixed(1)}</span>
                  </td>
                  <td className="gen-metric">
                    <span className="gen-value">{baselineWatts !== null ? baselineWatts.toFixed(1) : '-'}</span>
                  </td>
                  <td className="gen-metric">
                    <span className="gen-value">{baselineEff !== null ? baselineEff.toFixed(1) : '-'}</span>
                  </td>
                  <td className="gen-metric-small gen-muted">Reference</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="gen-stats-charts">
          <div className="gen-stats-chart-container">
            <ComparisonBarChart
              id="gen-fps-chart"
              title="Average FPS by Test Type"
              yLabel="Frames per Second"
              labels={comparison.all_tests}
              datasets={fpsDatasets}
              tooltipDiff={fpsTooltip}
            />
          </div>
          <div className="gen-stats-chart-container">
            <ComparisonBarChart
              id="gen-watts-chart"
              title="Average Power Usage by Test Type"
              yLabel="Watts"
              labels={comparison.all_tests}
              datasets={wattsDatasets}
              tooltipDiff={wattsTooltip}
            />
          </div>
          <div className="gen-stats-chart-container">
            <ComparisonBarChart
              id="gen-efficiency-chart"
              title="Efficiency (FPS per Watt) by Test Type"
              yLabel="FPS/Watt"
              labels={comparison.all_tests}
              datasets={efficiencyDatasets}
              tooltipDiff={efficiencyTooltip}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
