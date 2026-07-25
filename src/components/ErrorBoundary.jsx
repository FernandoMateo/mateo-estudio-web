import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[Mateo Estudio] Error atrapado:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050508', color: '#EDEBF6', padding: 24 }}>
          <div style={{ maxWidth: 520, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 18px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(251,113,133,.12)', border: '1px solid rgba(251,113,133,.35)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FB7185" strokeWidth="1.8"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Algo se rompió acá</h1>
            <p style={{ fontSize: 13, color: 'rgba(237,235,246,.55)', marginBottom: 18, lineHeight: 1.5 }}>
              La app encontró un error inesperado. Recargá la página — si el problema sigue, mandá una captura de este mensaje:
            </p>
            <pre style={{ fontSize: 11, textAlign: 'left', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 10, padding: 14, overflowX: 'auto', color: '#FCA5A5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button onClick={() => window.location.reload()}
              style={{ marginTop: 18, padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(167,139,250,.5)', background: 'linear-gradient(135deg, rgba(139,92,246,.5), rgba(124,58,237,.32))', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Recargar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
