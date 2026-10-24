import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal glass" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={box}>
        <button type="button" className="modal-x" onClick={onClose} aria-label={t('common.close')}>
          ×
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
