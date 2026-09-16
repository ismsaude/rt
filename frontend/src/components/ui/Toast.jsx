import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ICONS = { success: CheckCircle2, danger: XCircle, warning: AlertTriangle, info: Info };

const ToastContext = createContext(null);

/**
 * Substitui window.alert(). Mensagens não bloqueiam a interface e
 * são anunciadas por leitores de tela.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, { tone = 'info', duration = 4200 } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((list) => [...list, { id, message, tone }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration)
        );
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      show: push,
      success: (m, o) => push(m, { ...o, tone: 'success' }),
      error: (m, o) => push(m, { ...o, tone: 'danger', duration: 6500 }),
      warning: (m, o) => push(m, { ...o, tone: 'warning' }),
      info: (m, o) => push(m, { ...o, tone: 'info' }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-region" role="region" aria-label="Notificações">
          {toasts.map((t) => {
            const Icon = ICONS[t.tone] || Info;
            return (
              <div
                key={t.id}
                className={`toast toast--${t.tone}`}
                role={t.tone === 'danger' ? 'alert' : 'status'}
                aria-live={t.tone === 'danger' ? 'assertive' : 'polite'}
              >
                <Icon size={17} className="toast__icon" aria-hidden="true" />
                <div className="toast__body">{t.message}</div>
                <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dispensar">
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}
