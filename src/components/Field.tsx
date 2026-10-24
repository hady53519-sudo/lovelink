import { useId, type ReactNode } from 'react';
import { useI18n, type TKey } from '../i18n';

interface BaseProps {
  label: string;
  error?: TKey;
  hint?: string;
  optional?: boolean;
  /** Shows "n/max" under the control. */
  counter?: { value: number; max: number };
}

function Wrap({
  id,
  label,
  error,
  hint,
  optional,
  counter,
  children,
}: BaseProps & { id: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="opt"> ({t('common.optional')})</span>}
      </label>
      {children}
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      <div className="field-foot">
        {error ? (
          <p className="error" id={`${id}-err`} role="alert">
            {t(error)}
          </p>
        ) : (
          <span />
        )}
        {counter && (
          <span className={`counter ${counter.value > counter.max ? 'over' : ''}`}>
            {t('common.counter', { n: counter.value, max: counter.max })}
          </span>
        )}
      </div>
    </div>
  );
}

const describedBy = (id: string, error?: TKey, hint?: string) =>
  [error ? `${id}-err` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;

interface InputProps extends BaseProps {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'password' | 'date' | 'url';
  placeholder?: string;
  autoComplete?: string;
  dir?: 'ltr' | 'rtl';
  maxLength?: number;
}

export function TextField({ value, onChange, type = 'text', placeholder, autoComplete, dir, maxLength, ...rest }: InputProps) {
  const id = useId();
  return (
    <Wrap id={id} {...rest}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        dir={dir}
        maxLength={maxLength}
        aria-invalid={rest.error ? true : undefined}
        aria-describedby={describedBy(id, rest.error, rest.hint)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrap>
  );
}

interface AreaProps extends BaseProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}

export function TextArea({ value, onChange, placeholder, rows = 4, maxLength, ...rest }: AreaProps) {
  const id = useId();
  return (
    <Wrap id={id} {...rest}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={rest.error ? true : undefined}
        aria-describedby={describedBy(id, rest.error, rest.hint)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrap>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
}) {
  const id = useId();
  return (
    <label className="toggle" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span className="toggle-text">
        <strong>{label}</strong>
        {desc && <small>{desc}</small>}
      </span>
    </label>
  );
}
