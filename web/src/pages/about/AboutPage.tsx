import { useDocumentTitle } from '../../layout/useDocumentTitle'

export function AboutPage() {
  useDocumentTitle('About - QuickSync Benchmarks')

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <h1 style={{ marginBottom: '2rem' }}>About QuickSync Benchmarks</h1>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>What is this?</h2>
        <p>
          This is a community-driven database of Intel Quick Sync Video benchmark results. Quick Sync is Intel&apos;s
          hardware video encoding/decoding technology built into most Intel CPUs since Sandy Bridge (2nd generation).
        </p>
        <p style={{ marginTop: '1rem' }}>
          The benchmarks test hardware transcoding performance using FFmpeg inside a Jellyfin container, measuring:
        </p>
        <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
          <li>
            <strong>FPS</strong> - Frames per second throughput
          </li>
          <li>
            <strong>Watts</strong> - Power consumption during encoding
          </li>
          <li>
            <strong>Speed</strong> - Real-time multiplier (2x = twice real-time)
          </li>
          <li>
            <strong>Efficiency</strong> - FPS per watt (calculated)
          </li>
        </ul>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Test Types</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                Test
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                <code>h264_1080p_cpu</code>
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                CPU-only H.264 encode (baseline comparison)
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                <code>h264_1080p</code>
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Quick Sync H.264 encode at 1080p
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                <code>h264_4k</code>
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Quick Sync H.264 encode at 4K
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                <code>hevc_8bit</code>
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Quick Sync HEVC 8-bit encode at 1080p
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem' }}>
                <code>hevc_4k_10bit</code>
              </td>
              <td style={{ padding: '0.5rem' }}>Quick Sync HEVC 10-bit encode at 4K</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Running the Benchmark</h2>
        <p>To contribute your own results:</p>

        <h3 style={{ marginTop: '1rem', fontSize: '1rem' }}>1. Clone the repository</h3>
        <pre
          style={{
            background: 'var(--color-bg)',
            padding: '1rem',
            borderRadius: '0.5rem',
            overflowX: 'auto',
            marginTop: '0.5rem',
          }}
        >
          <code>{`git clone https://github.com/ironicbadger/quicksync_calc.git\ncd quicksync_calc`}</code>
        </pre>

        <h3 style={{ marginTop: '1rem', fontSize: '1rem' }}>2. Run the benchmark</h3>
        <pre
          style={{
            background: 'var(--color-bg)',
            padding: '1rem',
            borderRadius: '0.5rem',
            overflowX: 'auto',
            marginTop: '0.5rem',
          }}
        >
          <code>{`# Run benchmark (results upload automatically)\n./quicksync-benchmark.sh\n\n# Run with concurrency tests (tests maximum simultaneous encodes)\n./quicksync-benchmark.sh --concurrency\n\n# Run with your identifier to track your submissions\nQUICKSYNC_ID="my_homelab" ./quicksync-benchmark.sh --concurrency\n\n# Skip result upload\nQUICKSYNC_NO_SUBMIT=1 ./quicksync-benchmark.sh`}</code>
        </pre>

        <h3 style={{ marginTop: '1rem', fontSize: '1rem' }}>Requirements</h3>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Docker</li>
          <li>Intel CPU with Quick Sync support</li>
          <li>
            <code>intel-gpu-tools</code> package (for power measurement)
          </li>
          <li>
            <code>jq</code> (for JSON parsing)
          </li>
          <li>
            <code>bc</code> (for calculations)
          </li>
        </ul>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>CPU Score Methodology</h2>
        <p>Each CPU receives an overall score (0-100) calculated from three weighted components:</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', marginBottom: '1rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Component
              </th>
              <th style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Weight
              </th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                <strong>Performance</strong>
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                40%
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Percentile rank of average FPS compared to all CPUs for each test type
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                <strong>Efficiency</strong>
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                35%
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Percentile rank of FPS per watt (energy efficiency)
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem' }}>
                <strong>Codec Support</strong>
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>25%</td>
              <td style={{ padding: '0.5rem' }}>Percentage of available test types the CPU has completed</td>
            </tr>
          </tbody>
        </table>

        <p>
          <strong>Formula:</strong> <code>Score = (Performance × 0.40) + (Efficiency × 0.35) + (Codec Support × 0.25)</code>
        </p>

        <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1rem' }}>Score Interpretation</h3>
        <ul style={{ marginLeft: '1.5rem' }}>
          <li>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>90-100</span> - Excellent: Top tier performance and
            efficiency
          </li>
          <li>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>70-89</span> - Good: Above average across most metrics
          </li>
          <li>
            <span style={{ color: '#eab308', fontWeight: 600 }}>50-69</span> - Average: Typical performance for its
            generation
          </li>
          <li>
            <span style={{ color: '#eab308', fontWeight: 600 }}>30-49</span> - Below Average: Limited in some areas
          </li>
          <li>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>0-29</span> - Limited: Older or constrained hardware
          </li>
        </ul>

        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          <strong>Note:</strong> Scores are calculated dynamically and updated automatically as new benchmark results
          are submitted. Percentile rankings are relative to all CPUs in the database.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Hardware Codec Support</h2>
        <p>Not all Intel CPUs support all codecs. Here&apos;s a quick reference:</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Architecture
              </th>
              <th style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                H.264
              </th>
              <th style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                HEVC 8-bit
              </th>
              <th style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                HEVC 10-bit
              </th>
              <th style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                AV1
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Kaby Lake - Comet Lake (7-10th)
              </td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>-</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>-</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                Tiger Lake - Raptor Lake (11-14th)
              </td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>decode only</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>Arc GPUs</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem' }}>Meteor Lake, Arrow Lake, Lunar Lake (Ultra)</td>
              <td style={{ textAlign: 'center', padding: '0.5rem' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem' }}>✓</td>
              <td style={{ textAlign: 'center', padding: '0.5rem' }}>✓</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Privacy</h2>
        <p>This project collects only:</p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>
            <strong>CPU model</strong> - Hardware information, not personally identifiable
          </li>
          <li>
            <strong>Benchmark metrics</strong> - FPS, watts, speed
          </li>
          <li>
            <strong>Submitter ID</strong> (optional) - Your chosen identifier for filtering your results
          </li>
        </ul>
        <p style={{ marginTop: '1rem' }}>
          IP addresses are used transiently for rate limiting only and are never stored. No cookies, no tracking, no
          personal data.
        </p>
      </div>
    </div>
  )
}
