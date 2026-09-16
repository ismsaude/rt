import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Alert from './Alert';

const ConfirmContext = createContext(null);

/**
 * Substitui window.confirm(). Ações destrutivas em prontuário merecem
 * um diálogo que diga exatamente o que será apagado.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    setState({
      title: 'Confirmar ação',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
      ...opts,
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => settle(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)}>
              {state?.cancelLabel}
            </Button>
            <Button variant={state?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)}>
              {state?.confirmLabel}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text)', lineHeight: 'var(--leading-normal)' }}>{state?.message}</p>
        {state?.warning && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Alert tone="warning">{state.warning}</Alert>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>');
  return ctx;
}
