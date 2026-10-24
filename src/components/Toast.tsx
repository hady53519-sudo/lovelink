import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';

type Kind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}
interface ToastApi {
  push: (kind: Kind, message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: Kind, message: string) => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="region" aria-live="polite" aria-atomic="false">
        {items.map((x) => (
          <div key={x.id} className={`toast toast-${x.kind}`} role={x.kind === 'error' ? 'alert' : 'status'}>
            <span>{x.message}</span>
            <button type="button" className="toast-x" onClick={() => dismiss(x.id)} aria-label={t('toast.dismiss')}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
