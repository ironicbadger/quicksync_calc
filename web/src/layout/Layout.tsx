import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header style={{ borderBottom: '1px solid var(--color-border)', padding: '1rem 0' }}>
        <div
          className="container"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Link to="/" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)' }}>
            QuickSync Benchmarks
          </Link>
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            <Link to="/">Dashboard</Link>
            <Link to="/cpu/gen/8">CPU Generations</Link>
            <Link to="/leaderboard">Leaderboard</Link>
            <Link to="/about">About</Link>
            <a href="https://github.com/ironicbadger/quicksync_calc" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main style={{ padding: '2rem 0' }}>{children}</main>

      <footer style={{ borderTop: '1px solid var(--color-border)', padding: '2rem 0', marginTop: '4rem' }}>
        <div className="container" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <p>Intel Quick Sync Video Benchmark Database</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Data sourced from community submissions &bull;{' '}
            <a href="https://github.com/ironicbadger/quicksync_calc">Contribute on GitHub</a>
          </p>
        </div>
      </footer>
    </>
  )
}

