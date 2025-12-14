import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_URL } from '../../app/config'
import { useDocumentTitle } from '../../layout/useDocumentTitle'
import './styles.css'

const TURNSTILE_SITE_KEY = '0x4AAAAAACE2xYy4W4qewY3u'

type PendingResult = {
  cpu_raw: string
  architecture: string | null
  test_name: string
  bitrate_kbps: number
  time_seconds: number
  avg_fps: number
  avg_speed: number | null
  avg_watts: number | null
  fps_per_watt: number | null
}

type PendingConcurrencyResult = {
  test_name: string
  speeds_json: string
  max_concurrency: number
}

type PendingResponse = {
  success: boolean
  expired?: boolean
  error?: string
  results?: PendingResult[]
  concurrencyResults?: PendingConcurrencyResult[]
}

type ConfirmResponse = {
  success: boolean
  expired?: boolean
  error?: string
  message?: string
  inserted?: number
  concurrency_inserted?: number
  turnstile_errors?: unknown
}

type PendingLoadResult =
  | { kind: 'error'; title: string; message: string }
  | { kind: 'ok'; data: PendingResponse }

function formatTestName(name: string) {
  return name
    .replace(/_/g, ' ')
    .replace(/h264/i, 'H.264')
    .replace(/hevc/i, 'HEVC')
    .replace(/8bit/i, '8-bit')
    .replace(/10bit/i, '10-bit')
    .replace(/1080p/i, '1080p')
    .replace(/4k/i, '4K')
}

function getTestType(name: string) {
  if (name.includes('h264')) return 'h264'
  if (name.includes('hevc')) return 'hevc'
  return 'other'
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string, options: Record<string, unknown>) => string
      reset: () => void
    }
  }
}

export function SubmitPage() {
  useDocumentTitle('Submit Results - QuickSync Benchmarks')

  const [params] = useSearchParams()
  const token = params.get('token')
  const urlSubmitterId = params.get('id') ?? ''

  const [state, setState] = useState<
    | { status: 'missing_token' }
    | { status: 'loading' }
    | { status: 'error'; title: string; message: string }
    | { status: 'success'; message: string }
    | {
        status: 'preview'
        results: PendingResult[]
        concurrencyResults: PendingConcurrencyResult[]
      }
  >({ status: token ? 'loading' : 'missing_token' })

  const [submitterId, setSubmitterId] = useState(urlSubmitterId)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [captchaError, setCaptchaError] = useState(false)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    setState({ status: 'loading' })

    fetch(`${API_URL}/api/submit/pending/${token}`)
      .then(async (res): Promise<PendingLoadResult> => {
        const data = (await res.json()) as PendingResponse
        if (!res.ok || !data.success) {
          if (data.expired) {
            return { kind: 'error', title: 'Submission Expired', message: 'This link has expired. Please run the benchmark again to get a new submission link.' }
          }
          return { kind: 'error', title: 'Submission Not Found', message: data.error || 'Unable to load your submission.' }
        }
        return { kind: 'ok', data }
      })
      .then((result) => {
        if (cancelled) return
        if (result.kind === 'error') {
          setState({ status: 'error', title: result.title, message: result.message })
          return
        }
        const results = result.data.results ?? []
        const concurrencyResults = result.data.concurrencyResults ?? []
        setState({ status: 'preview', results, concurrencyResults })
      })
      .catch(() => {
        if (cancelled) return
        setState({ status: 'error', title: 'Connection Error', message: 'Unable to connect to the server. Please try again.' })
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const resultsMeta = useMemo(() => {
    if (state.status !== 'preview' || state.results.length === 0) return null
    const cpu = state.results[0].cpu_raw.replace(/\(R\)|\(TM\)/g, '').replace(/CPU.*/, '').trim()
    const arch = state.results[0].architecture || 'Unknown'
    const count = state.results.length
    return { cpu, arch, count }
  }, [state])

  useEffect(() => {
    if (state.status !== 'preview') return

    setCaptchaError(false)
    setTurnstileToken(null)

    const container = document.getElementById('turnstile-container')
	    container?.replaceChildren()

	    const ensureScript = () => {
	      const existing = document.querySelector<HTMLScriptElement>('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]')
	      if (existing) return
	      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const tryRender = () => {
      if (!window.turnstile) return false
      const container = document.getElementById('turnstile-container')
      if (!container) return false
      if (container.childElementCount > 0) return true
      window.turnstile.render('#turnstile-container', {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (t: string) => {
          setCaptchaError(false)
          setTurnstileToken(t)
        },
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': () => {
          setCaptchaError(true)
          setTurnstileToken(null)
        },
      })
      return true
    }

    ensureScript()

    let tries = 0
    const timer = setInterval(() => {
      tries += 1
      if (tryRender() || tries > 200) clearInterval(timer)
    }, 50)

    return () => {
      clearInterval(timer)
      document.getElementById('turnstile-container')?.replaceChildren()
    }
  }, [state.status])

  async function handleSubmit() {
    if (!token || !turnstileToken || isSubmitting) return

    setIsSubmitting(true)
    setCaptchaError(false)
    try {
      const response = await fetch(`${API_URL}/api/submit/pending/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          turnstile_token: turnstileToken,
          submitter_id: submitterId.trim() || null,
        }),
      })

      const data = (await response.json()) as ConfirmResponse
      if (!response.ok || !data.success) {
        if (data.expired) {
          setState({ status: 'error', title: 'Submission Expired', message: 'This link has expired. Please run the benchmark again.' })
          return
        }
        if (data.turnstile_errors) {
          setCaptchaError(true)
          setTurnstileToken(null)
          window.turnstile?.reset()
          return
        }
        setState({ status: 'error', title: 'Submission Failed', message: data.error || 'An error occurred while submitting.' })
        return
      }

      let message = data.message
      if (!message) {
        const parts = []
        if ((data.inserted || 0) > 0) parts.push(`${data.inserted} benchmark result${data.inserted !== 1 ? 's' : ''}`)
        if ((data.concurrency_inserted || 0) > 0)
          parts.push(`${data.concurrency_inserted} concurrency result${data.concurrency_inserted !== 1 ? 's' : ''}`)
        message = parts.length > 0 ? `Successfully submitted ${parts.join(' and ')}!` : 'All results were already in the database.'
      }
      setState({ status: 'success', message })
    } catch {
      setState({ status: 'error', title: 'Connection Error', message: 'Unable to connect to the server. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-submit">
      <div className="container submit-page">
        {state.status === 'missing_token' ? (
          <div id="error-state" className="state-container">
            <div className="error-icon">!</div>
            <h2 id="error-title">No Token Provided</h2>
            <p id="error-message">Please use the link provided by the benchmark script.</p>
            <Link to="/" className="btn btn-primary">
              View All Results
            </Link>
          </div>
        ) : null}

        {state.status === 'loading' ? (
          <div id="loading-state" className="state-container">
            <div className="loading-spinner" />
            <p>Loading your benchmark results...</p>
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div id="error-state" className="state-container">
            <div className="error-icon">!</div>
            <h2 id="error-title">{state.title}</h2>
            <p id="error-message">{state.message}</p>
            <Link to="/" className="btn btn-primary">
              View All Results
            </Link>
          </div>
        ) : null}

        {state.status === 'success' ? (
          <div id="success-state" className="state-container">
            <div className="success-icon">✓</div>
            <h2>Results Submitted!</h2>
            <p id="success-message">{state.message}</p>
            <Link to="/" className="btn btn-primary">
              View All Results
            </Link>
          </div>
        ) : null}

        {state.status === 'preview' ? (
          <div id="preview-state">
            <div className="page-header">
              <h1>Submit Your Benchmark Results</h1>
              <p className="subtitle">
                Review your results and complete verification to add them to the database.
              </p>
            </div>

            <div className="card results-preview">
              <div className="card-header">
                <h2>Standard Benchmark Results</h2>
                <span id="results-meta" className="results-meta">
                  {resultsMeta ? (
                    <>
                      <strong>{resultsMeta.cpu}</strong> &bull; {resultsMeta.arch} &bull; {resultsMeta.count} test
                      {resultsMeta.count !== 1 ? 's' : ''}
                    </>
                  ) : null}
                </span>
              </div>

              <div className="table-wrapper">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Bitrate</th>
                      <th>Time</th>
                      <th>FPS</th>
                      <th>Speed</th>
                      <th>Watts</th>
                      <th>Efficiency</th>
                    </tr>
                  </thead>
                  <tbody id="results-tbody">
                    {state.results.map((r, idx) => {
                      const testDisplay = formatTestName(r.test_name)
                      const speedDisplay = r.avg_speed ? `${r.avg_speed.toFixed(2)}x` : 'N/A'
                      const wattsDisplay = r.avg_watts ? `${r.avg_watts.toFixed(1)}W` : 'N/A'
                      const effDisplay = r.fps_per_watt ? r.fps_per_watt.toFixed(2) : 'N/A'

                      return (
                        <tr key={idx}>
                          <td>
                            <span className={`test-badge test-${getTestType(r.test_name)}`}>{testDisplay}</span>
                          </td>
                          <td>{r.bitrate_kbps} kb/s</td>
                          <td>{r.time_seconds.toFixed(1)}s</td>
                          <td className="metric-cell">{r.avg_fps.toFixed(1)}</td>
                          <td className="metric-cell">{speedDisplay}</td>
                          <td className="metric-cell">{wattsDisplay}</td>
                          <td className="metric-cell">{effDisplay}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {state.concurrencyResults.length > 0 ? (
              <div id="concurrency-preview" className="card results-preview">
                <div className="card-header">
                  <h2>Concurrency Test Results</h2>
                  <span id="concurrency-meta" className="results-meta">
                    {state.concurrencyResults.length} test{state.concurrencyResults.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="table-wrapper">
                  <table className="results-table concurrency-table">
                    <thead>
                      <tr>
                        <th>Test</th>
                        {Array.from({ length: 10 }, (_, i) => (
                          <th key={i}>{i + 1}x</th>
                        ))}
                        <th>Max</th>
                      </tr>
                    </thead>
                    <tbody id="concurrency-tbody">
                      {state.concurrencyResults.map((r, idx) => {
                        const testDisplay = formatTestName(r.test_name)
                        const speeds: Array<number | null> = (() => {
                          try {
                            return JSON.parse(r.speeds_json) as Array<number | null>
                          } catch {
                            return []
                          }
                        })()

                        const maxClass = r.max_concurrency >= 4 ? 'max-good' : r.max_concurrency >= 2 ? 'max-ok' : 'max-low'

                        return (
                          <tr key={idx}>
                            <td>
                              <span className={`test-badge test-${getTestType(r.test_name)}`}>{testDisplay}</span>
                            </td>
                            {Array.from({ length: 10 }, (_, i) => {
                              const speed = speeds[i + 1]
                              if (speed === undefined || speed === null) return <td key={i} className="metric-cell speed-na">-</td>
                              const speedClass = speed >= 1.0 ? 'speed-good' : 'speed-warn'
                              return (
                                <td key={i} className={`metric-cell ${speedClass}`}>
                                  {speed.toFixed(2)}x
                                </td>
                              )
                            })}
                            <td className={`metric-cell max-concurrency ${maxClass}`}>{r.max_concurrency}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="card submitter-section">
              <h2>
                Submitter ID <span className="optional-label">(optional)</span>
              </h2>
              <p className="field-description">
                Add an identifier to track your submissions. This helps you find your results later.
              </p>
              <input
                type="text"
                id="submitter-id"
                placeholder="e.g., alexs_homelab, my_server"
                className="text-input"
                maxLength={50}
                value={submitterId}
                onChange={(e) => setSubmitterId(e.target.value)}
              />
            </div>

            <div className="card captcha-section">
              <h2>Verification</h2>
              <p className="field-description">Complete the verification below to submit your results.</p>
              <div id="turnstile-container" className="turnstile-widget" />
              {captchaError ? (
                <p id="captcha-error" className="captcha-error">
                  Verification failed. Please try again.
                </p>
              ) : null}
            </div>

            <div className="submit-section">
              <button
                id="submit-btn"
                className="btn btn-primary btn-large"
                disabled={!turnstileToken || isSubmitting}
                onClick={() => void handleSubmit()}
              >
                <span id="submit-text">{isSubmitting ? 'Submitting...' : turnstileToken ? 'Submit Results' : 'Complete Verification Above'}</span>
                {isSubmitting ? <span id="submit-spinner" className="btn-spinner" /> : null}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
