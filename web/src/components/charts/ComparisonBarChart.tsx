import { useEffect, useRef } from 'react'
import { ChartJS } from '../../utils/chartjs'
import type { ComparisonByTestStats, ComparisonMetric } from '../../utils/comparisons'

type Dataset = {
  label: string
  data: number[]
  backgroundColor: string
  borderColor: string
  borderWidth?: number
}

type TooltipDiffConfig = {
  baseline_by_test: ComparisonByTestStats[]
  metric: ComparisonMetric
}

type Props = {
  id: string
  title: string
  yLabel: string
  labels: string[]
  datasets: Dataset[]
  tooltipDiff?: TooltipDiffConfig
}

export function ComparisonBarChart({ id, title, yLabel, labels, datasets, tooltipDiff }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const chart = new ChartJS(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#f1f5f9', font: { size: 11 } },
          },
          title: {
            display: true,
            text: title,
            color: '#f1f5f9',
            font: { size: 13, weight: 600 },
          },
          tooltip: tooltipDiff
            ? {
                callbacks: {
                  afterLabel: (context) => {
                    const gen = Number.parseInt(String(context.dataset.label), 10)
                    if (gen === 8) return ''

                    const metric = tooltipDiff.metric
                    const testName = labels[context.dataIndex]
                    const baselineTest = tooltipDiff.baseline_by_test.find((t) => t.test_name === testName)
                    const baseVal = baselineTest?.[metric]
                    const raw = typeof context.raw === 'number' ? context.raw : Number(context.raw)

                    if (!baseVal || baseVal <= 0 || !Number.isFinite(raw)) return ''

                    const diff = metric === 'avg_watts' ? ((baseVal - raw) / baseVal) * 100 : ((raw - baseVal) / baseVal) * 100
                    return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}% vs 8th Gen`
                  },
                },
              }
            : undefined,
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
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
  }, [datasets, labels, title, tooltipDiff, yLabel])

  return <canvas id={id} ref={canvasRef} />
}
