import { useEffect, useMemo, useRef } from 'react'
import { testColors } from '../../utils/chartColors'
import { ChartJS } from '../../utils/chartjs'
import { computeConcurrencyByGenAndTest } from '../../utils/quicksync'
import type { ConcurrencyResult } from '../../app/types'

function groupToLabel(group: string): string {
  if (group === 'U1') return 'Ultra 1'
  if (group === 'U2') return 'Ultra 2'
  if (group === 'Arc') return 'Arc'
  if (Number.isNaN(Number.parseInt(group, 10))) return group
  return `Gen ${group}`
}

export function ConcurrencyChart({ concurrencyResults }: { concurrencyResults: ConcurrencyResult[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const { generations, tests, maxByGenAndTest } = useMemo(() => {
    const maxByGenAndTest = computeConcurrencyByGenAndTest(concurrencyResults)
    const allGroups = [...new Set(Object.values(maxByGenAndTest).map((d) => d.group))]

    const numericGroups = allGroups
      .filter((g) => !Number.isNaN(Number.parseInt(g, 10)) && Number.parseInt(g, 10) >= 6)
      .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))

    const nonNumericOrder = ['U1', 'U2', 'Arc']
    const nonNumericGroups = allGroups
      .filter((g) => Number.isNaN(Number.parseInt(g, 10)))
      .sort((a, b) => {
        const aIdx = nonNumericOrder.indexOf(a)
        const bIdx = nonNumericOrder.indexOf(b)
        if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
        if (aIdx === -1) return 1
        if (bIdx === -1) return -1
        return aIdx - bIdx
      })

    return {
      generations: [...numericGroups, ...nonNumericGroups],
      tests: [...new Set(Object.values(maxByGenAndTest).map((d) => d.test))],
      maxByGenAndTest,
    }
  }, [concurrencyResults])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const datasets = tests.map((test) => {
      const colors = testColors[test] || { bg: 'rgba(148, 163, 184, 0.6)', border: 'rgb(148, 163, 184)' }
      return {
        label: test,
        data: generations.map((gen) => maxByGenAndTest[`${gen}|${test}`]?.max_concurrency ?? null),
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 1,
      }
    })

    const chart = new ChartJS(canvas, {
      type: 'bar',
      data: { labels: generations.map(groupToLabel), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 8 },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(71, 85, 105, 0.5)',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}x streams`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 11 } },
            grid: { color: 'rgba(71, 85, 105, 0.3)' },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Max Concurrent Streams', color: '#94a3b8', font: { size: 11 } },
            ticks: { color: '#94a3b8', font: { size: 11 } },
            grid: { color: 'rgba(71, 85, 105, 0.3)' },
          },
        },
      },
    })

    return () => chart.destroy()
  }, [generations, maxByGenAndTest, tests])

  return (
    <div className="chart-container card" id="concurrency-chart-container">
      <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>
        Max Concurrent Streams by Generation
      </h3>
      <div className="chart-wrapper">
        <canvas id="concurrency-chart" ref={canvasRef} />
      </div>
    </div>
  )
}

