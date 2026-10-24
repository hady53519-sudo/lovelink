import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ConfigNotice } from '../components/ConfigNotice';
import { FloatingHearts } from '../components/Layout';
import { SurpriseView } from '../components/SurpriseView';
import { makeT, useI18n } from '../i18n';
import { isConfigured } from '../lib/supabase';
import { fetchPublic } from '../services/public';
import type { Lang, PublicFetchStatus, PublicSurprise, Theme, ViewPhoto } from '../types';
import NotFound from './NotFound';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not_found' }
  | { kind: 'password'; hint: { lang: Lang; theme: Theme }; problem?: PublicFetchStatus }
  | { kind: 'ok'; page: PublicSurprise };

/** Keeps private pages out of search engines. */
function useNoIndex() {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    return () => {
      document.head.removeChild(m);
    };
  }, []);
}

export default function SurprisePage() {
  const { slug = '' } = useParams();
  const { t } = useI18n();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  useNoIndex();

  const open = useCallback(
    async (pw?: string) => {
      try {
        const res = await fetchPublic(slug, pw);
        if (res.status === 'not_found') return setState({ kind: 'not_found' });
        if (res.status === 'ok' && res.surprise) {
          document.title = `${res.surprise.title || 'LoveLink'} · LoveLink`;
          return setState({ kind: 'ok', page: res.surprise });
        }
        // password_required / wrong_password / locked
        setState((prev) => ({
          kind: 'password',
          hint: res.hint ?? (prev.kind === 'password' ? prev.hint : { lang: 'en', theme: 'elegant' }),
          problem: res.status,
        }));
      } catch {
        setState({ kind: 'error' });
      }
    },
    [slug],
  );

  useEffect(() => {
    if (!isConfigured) return;
    setState({ kind: 'loading' });
    void open();
  }, [open]);

  // Photo links arrive with the page data (for protected pages only after the password was verified).
  const view = useMemo(() => {
    if (state.kind !== 'ok') return null;
    const gallery: ViewPhoto[] = state.page.photos
      .filter((p) => p.kind === 'gallery' && p.url)
      .map((p) => ({ url: p.url, caption: p.caption }));
    const bg = state.page.photos.find((p) => p.kind === 'background')?.url || undefined;
    const missing = state.page.photos.some((p) => !p.url);
    return { gallery, bg, missing };
  }, [state]);

  if (!isConfigured) {
    return (
      <div className="container page narrow">
        <ConfigNotice />
      </div>
    );
  }
  if (state.kind === 'loading') {
    return (
      <div className="center-screen" role="status" aria-label={t('s.loading')}>
        <div className="loading-heart" aria-hidden="true">💖</div>
        <p className="muted">{t('s.loading')}</p>
      </div>
    );
  }
  if (state.kind === 'not_found') return <NotFound />;
  if (state.kind === 'error') {
    return (
      <div className="center-screen">
        <p>{t('s.loadError')}</p>
        <button type="button" className="btn btn-primary" onClick={() => void open()}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (state.kind === 'password') {
    const tt = makeT(state.hint.lang);
    const submit = async (e: FormEvent) => {
      e.preventDefault();
      if (!password) return;
      setChecking(true);
      await open(password);
      setChecking(false);
    };
    return (
      <div className={`center-screen sv-${state.hint.theme}`} dir={state.hint.lang === 'ar' ? 'rtl' : 'ltr'} lang={state.hint.lang}>
        <FloatingHearts />
        <form className="glass pad lock" onSubmit={submit}>
          <div className="lock-icon" aria-hidden="true">🔒</div>
          <h1>{tt('s.passwordTitle')}</h1>
          <p className="muted">{tt('s.passwordSub')}</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tt('s.passwordPh')}
            aria-label={tt('s.passwordPh')}
            autoComplete="off"
            dir="ltr"
            maxLength={72}
            autoFocus
          />
          {state.problem === 'wrong_password' && <p className="error" role="alert">{tt('s.wrong')}</p>}
          {state.problem === 'locked' && <p className="error" role="alert">{tt('s.locked')}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={checking || !password}>
            {checking ? tt('s.unlocking') : tt('s.unlock')}
          </button>
        </form>
      </div>
    );
  }

  const tt = makeT(state.page.lang);
  return (
    <div className="public-wrap">
      <FloatingHearts />
      <SurpriseView
        content={state.page}
        photos={view?.gallery ?? []}
        background={view?.bg}
        mode="public"
        photosNote={view?.missing ? tt('s.photosFailed') : undefined}
      />
    </div>
  );
}
