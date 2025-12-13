import { useMemo } from 'react'
import { ComparisonBarChart } from '../../components/charts/ComparisonBarChart'
import { ordinal, stripIntelBranding } from '../../utils/quicksync'
import type { ComparisonMetric, CpuComparisonData } from '../../utils/comparisons'

const CPU_COLORS = [
  { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' },
  { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' },
  { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' },
  { bg: 'rgba(234, 88, 12, 0.8)', border: 'rgb(234, 88, 12)' },
  { bg: 'rgba(6, 182, 212, 0.8)', border: 'rgb(6, 182, 212)' },
  { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)' },
  { bg: 'rgba(202, 138, 4, 0.8)', border: 'rgb(202, 138, 4)' },
  { bg: 'rgba(20, 184, 166, 0.8)', border: 'rgb(20, 184, 166)' },
]

export function CpuComparisonPanel({ comparison }: { comparison: CpuComparisonData }) {
  const cpuCount = comparison.cpus.length
  const totalResults = comparison.cpus.reduce((sum, c) => sum + c.overall.total_results, 0)

  function buildDatasets(metric: ComparisonMetric) {
    return comparison.cpus.map((cpuData, idx) => {
      const colors = CPU_COLORS[idx % CPU_COLORS.length]
      const displayName = stripIntelBranding(cpuData.cpu_raw)
      const label = displayName.length > 20 ? `${displayName.slice(0, 20)}...` : displayName
      const data = comparison.all_tests.map((testName) => {
        const testInfo = cpuData.by_test.find((t) => t.test_name === testName)
        const raw = testInfo ? testInfo[metric] : null
        return typeof raw === 'number' ? raw : 0
      })
      return { label, data, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }
    })
  }

  const fpsDatasets = useMemo(() => buildDatasets('avg_fps'), [comparison.all_tests, comparison.cpus])
  const wattsDatasets = useMemo(() => buildDatasets('avg_watts'), [comparison.all_tests, comparison.cpus])
  const efficiencyDatasets = useMemo(() => buildDatasets('fps_per_watt'), [comparison.all_tests, comparison.cpus])

  return (
    <div id="cpu-stats" className="generation-stats cpu-stats-panel">
      <div className="gen-stats-header">
        <h3 id="cpu-stats-title">
          {cpuCount === 1 ? `CPU: ${stripIntelBranding(comparison.cpus[0].cpu_raw)}` : `Comparing ${cpuCount} CPUs`}
        </h3>
        <span id="cpu-stats-subtitle" className="gen-stats-subtitle">
          {totalResults} benchmark results
        </span>
      </div>

      <div className="gen-stats-content">
        <div id="cpu-stats-summary" className="gen-stats-summary">
          <table className="gen-comparison-table">
            <thead>
              <tr>
                <th>CPU</th>
                <th>Architecture</th>
                <th>Avg FPS</th>
                <th>Avg Watts</th>
                <th>Efficiency</th>
                <th>Results</th>
              </tr>
            </thead>
            <tbody>
              {comparison.cpus.map((cpuData, idx) => {
                const colors = CPU_COLORS[idx % CPU_COLORS.length]
                const displayName = stripIntelBranding(cpuData.cpu_raw)
                const displayText = displayName.length > 30 ? `${displayName.slice(0, 30)}...` : displayName

                return (
                  <tr key={cpuData.cpu_raw} className="gen-row">
                    <td className="gen-name">
                      <span className="gen-indicator" style={{ background: colors.border }} />
                      <strong title={cpuData.cpu_raw}>{displayText}</strong>
                    </td>
                    <td>
                      {cpuData.architecture ? <span className="gen-arch">{cpuData.architecture}</span> : '-'}{' '}
                      {cpuData.cpu_generation ? <span className="gen-arch">{ordinal(cpuData.cpu_generation)} Gen</span> : null}
                    </td>
                    <td className="gen-metric">
                      <span className="gen-value">
                        {Number.isFinite(cpuData.overall.avg_fps) ? cpuData.overall.avg_fps.toFixed(1) : '-'}
                      </span>
                    </td>
                    <td className="gen-metric">
                      <span className="gen-value">{cpuData.overall.avg_watts !== null ? cpuData.overall.avg_watts.toFixed(1) : '-'}</span>
                    </td>
                    <td className="gen-metric">
                      <span className="gen-value">{cpuData.overall.fps_per_watt !== null ? cpuData.overall.fps_per_watt.toFixed(1) : '-'}</span>
                    </td>
                    <td className="gen-metric-small">{cpuData.overall.total_results}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="gen-stats-charts">
          <div className="gen-stats-chart-container">
            <ComparisonBarChart
              id="cpu-fps-chart"
              title="Average FPS by Test Type"
              yLabel="Frames per Second"
              labels={comparison.all_tests}
              datasets={fpsDatasets}
            />
          </div>
          <div className="gen-stats-chart-container">
            <ComparisonBarChart
              id="cpu-watts-chart"
              title="Average Power Usage by Test Type"
              yLabel="Watts"
              labels={comparison.all_tests}
              datasets={wattsDatasets}
            />
          </div>
          <div className="gen-stats-chart-container">
            <ComparisonBarChart
              id="cpu-efficiency-chart"
              title="Efficiency (FPS per Watt) by Test Type"
              yLabel="FPS/Watt"
              labels={comparison.all_tests}
              datasets={efficiencyDatasets}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
