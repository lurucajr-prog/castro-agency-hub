// ============================================================
// Castro Agency Hub — Error Boundary
// Place this file at: src/components/ErrorBoundary.jsx
// ============================================================
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset() {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        padding: '60px 40px',
        textAlign: 'center',
        background: 'var(--bg)',
        minHeight: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>

        <div style={{
          fontSize: 17,
          fontWeight: 600,
          color: 'var(--text-1)',
          marginBottom: 8,
        }}>
          Something went wrong on this page
        </div>

        <div style={{
          fontSize: 13,
          color: 'var(--text-3)',
          marginBottom: 8,
          maxWidth: 420,
          lineHeight: 1.6,
        }}>
          An unexpected error occurred. Your other pages are still working fine.
          Try clicking the button below or navigating to a different page.
        </div>

        {this.state.error && (
          <details style={{ marginBottom: 20 }}>
            <summary style={{ fontSize: 11, color: 'var(--text-4)', cursor: 'pointer', marginBottom: 6 }}>
              Show error details
            </summary>
            <pre style={{
              fontSize: 10,
              color: 'var(--danger)',
              background: 'var(--danger-light)',
              padding: '10px 14px',
              borderRadius: 8,
              textAlign: 'left',
              maxWidth: 500,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}>
              {this.state.error.message}
            </pre>
          </details>
        )}

        <button
          onClick={() => this.reset()}
          style={{
            padding: '9px 20px',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </div>
    )
  }
}
