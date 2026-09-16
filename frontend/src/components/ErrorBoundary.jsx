import React from 'react';
import { AlertOctagon, RotateCw } from 'lucide-react';
import Button from './ui/Button';

/**
 * Impede que um erro de renderização derrube o sistema inteiro em
 * tela branca — cenário inaceitável durante um plantão.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Ponto de integração para monitoramento (Sentry etc.)
    console.error('[AUREAN RT] Falha de renderização:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 'var(--space-6)',
          background: 'var(--canvas)',
        }}
      >
        <div className="card" style={{ maxWidth: 460, width: '100%' }}>
          <div className="card__body">
            <div className="empty">
              <div className="empty__icon" style={{ background: 'var(--danger-subtle)', color: 'var(--danger)' }}>
                <AlertOctagon size={24} />
              </div>
              <p className="empty__title">Algo deu errado nesta tela</p>
              <p className="empty__description">
                O restante do sistema continua funcionando. Recarregue a página para tentar de novo.
                Se o erro persistir, avise a supervisão.
              </p>
              <div className="empty__action">
                <Button variant="primary" icon={RotateCw} onClick={() => window.location.reload()}>
                  Recarregar
                </Button>
              </div>
            </div>
            <details style={{ marginTop: 'var(--space-4)' }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-subtle)',
                }}
              >
                Detalhes técnicos
              </summary>
              <pre
                style={{
                  marginTop: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  background: 'var(--surface-sunken)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {String(this.state.error?.stack || this.state.error)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }
}
