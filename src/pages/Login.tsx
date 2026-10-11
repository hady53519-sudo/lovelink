import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthForm } from '../components/AuthForm';
import { useAuth } from '../hooks/useAuth';

/** Only same-site relative paths are accepted, so the login page cannot be used as an open redirect. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) return raw;
  return '/my';
}

export default function Login() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const next = safeNext(params.get('next'));

  useEffect(() => {
    if (user) nav(next, { replace: true });
  }, [user, next, nav]);

  return (
    <div className="container page narrow">
      <div className="glass pad">
        <AuthForm onSuccess={() => nav(next, { replace: true })} />
      </div>
    </div>
  );
}
