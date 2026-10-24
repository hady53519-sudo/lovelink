import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useI18n, type TKey } from '../i18n';
import { toErrorKey } from '../lib/errors';
import { isConfigured } from '../lib/supabase';
import { validateEmail } from '../lib/validation';
import { ConfigNotice } from './ConfigNotice';
import { TextField } from './Field';
import { useToast } from './Toast';

export function AuthForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n();
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: TKey; password?: TKey }>({});
  const [busy, setBusy] = useState(false);

  if (!isConfigured) return <ConfigNotice />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: { email?: TKey; password?: TKey } = {};
    const ev = validateEmail(email);
    if (ev) next.email = ev;
    if (!password) next.password = 'err.required';
    else if (mode === 'signup' && password.length < 6) next.password = 'err.authWeak';
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        toast.push('success', t('auth.loggedIn'));
        onSuccess();
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          toast.push('info', t('auth.checkEmail'));
          setMode('login');
        } else {
          toast.push('success', t('auth.loggedIn'));
          onSuccess();
        }
      }
    } catch (err) {
      toast.push('error', t(toErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="auth-form">
      <h2>{mode === 'login' ? t('auth.loginTitle') : t('auth.signupTitle')}</h2>
      <p className="muted">{mode === 'login' ? t('auth.loginSub') : t('auth.signupSub')}</p>
      <TextField
        label={t('auth.email')}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        dir="ltr"
        error={errors.email}
      />
      <TextField
        label={t('auth.password')}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        dir="ltr"
        error={errors.password}
      />
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? t('auth.working') : mode === 'login' ? t('auth.login') : t('auth.signup')}
      </button>
      <p className="muted auth-switch">
        {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? t('auth.signup') : t('auth.login')}
        </button>
      </p>
    </form>
  );
}
