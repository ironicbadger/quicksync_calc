import { useEffect, useMemo, useRef } from 'react'
import { testColors } from '../../utils/chartColors'
import { ChartJS } from '../../utils/chartjs'
import type { BoxplotPoint } from '../../utils/quicksync'

type Metric = 'avg_fps' | 'avg_watts' | 'fps_per_watt'

type Props = {
  id: string
  title: string
  metric: Metric
  points: BoxplotPoint[]
  selectedGenerationFilters: string[]
  onToggleGeneration: (genFilter: string) => void
  yLabel: string
}

function groupToFilter(group: string): string | null {
  if (group === 'U1') return 'ultra-1'
  if (group === 'U2') return 'ultra-2'
  if (group === 'Arc') return 'arc'
  if (!Number.isNaN(Number.parseInt(group, 10))) return group
  return null
}

function groupToLabel(group: string): string {
  if (group === 'U1') return 'Ultra 1'
  if (group === 'U2') return 'Ultra 2'
  if (group === 'Arc') return 'Arc'
  if (Number.isNaN(Number.parseInt(group, 10))) return group
  return `Gen ${group}`
}

export function BoxplotMedianChart({ id, title, points, selectedGenerationFilters, onToggleGeneration, yLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const { groups, tests } = useMemo(() => {
    const allGroups = [...new Set(points.map((d) => d.group))]
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
      groups: [...numericGroups, ...nonNumericGroups],
      tests: [...new Set(points.map((d) => d.test))],
    }
  }, [points])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const datasets = tests.map((test) => {
      const testData = points.filter((d) => d.test === test)
      const colors = testColors[test] || { bg: 'rgba(148, 163, 184, 0.6)', border: 'rgb(148, 163, 184)' }
      return {
        label: test,
        data: groups.map((g) => testData.find((d) => d.group === g)?.median ?? null),
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 1,
      }
    })

    const chart = new ChartJS(canvas, {
      type: 'bar',
      data: { labels: groups.map(groupToLabel), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements) => {
          if (elements.length === 0) return
          const index = elements[0].index
          const group = groups[index]
          const filterValue = groupToFilter(group)
          if (filterValue) onToggleGeneration(filterValue)
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const group = groups[items[0].dataIndex]
                const label = groupToLabel(group)
                const filterValue = groupToFilter(group)
                const isSelected = filterValue ? selectedGenerationFilters.includes(filterValue) : false
                return `${label}${isSelected ? ' (filtered)' : ''} - Click to toggle`
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: (ctx) => {
                const group = groups[ctx.index]
                const filterValue = groupToFilter(group)
                const isSelected = filterValue ? selectedGenerationFilters.includes(filterValue) : false
                return isSelected ? '#3b82f6' : '#94a3b8'
              },
              font: (ctx) => {
                const group = groups[ctx.index]
                const filterValue = groupToFilter(group)
                const isSelected = filterValue ? selectedGenerationFilters.includes(filterValue) : false
                return { weight: isSelected ? 'bold' : 'normal' }
              },
            },
            grid: { color: '#334155' },
          },
          y: {
            ticks: { color: '#94a3b8' },
            grid: { color: '#334155' },
            title: { display: true, text: yLabel, color: '#94a3b8' },
          },
        },
      },
    })

    return () => chart.destroy()
  }, [groups, onToggleGeneration, points, selectedGenerationFilters, tests, yLabel])

  return (
    <div className="chart-container card">
      <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>{title}</h3>
      <div className="chart-wrapper">
        <canvas id={id} ref={canvasRef} data-metric={id} data-ylabel={yLabel} />
      </div>
    </div>
  )
}

