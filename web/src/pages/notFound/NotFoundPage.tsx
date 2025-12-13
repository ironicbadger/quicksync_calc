import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../layout/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page Not Found - QuickSync Benchmarks')

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <div className="card" style={{ marginTop: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>404</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>That page doesn&apos;t exist.</p>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            background: 'var(--color-accent)',
            color: 'white',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}

