import { Component, type ReactNode } from 'react';
import { makeT } from '../i18n';

/** Last line of defence: a friendly screen instead of a blank page if rendering ever crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; msg: string }> {
  state = { failed: false, msg: '' };

  static getDerivedStateFromError(e: unknown) {
    return { failed: true, msg: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : String(e).slice(0, 300) };
  }

  componentDidCatch(error: unknown) {
    console.error('LoveLink crashed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = makeT(document.documentElement.lang === 'ar' ? 'ar' : 'en');
    return (
      <div className="center-screen" role="alert">
        <div className="loading-heart" aria-hidden="true">💔</div>
        <h1>{t('err.boundaryTitle')}</h1>
        <p className="muted">{t('err.boundaryBody')}</p>
        <p className="muted" dir="ltr" style={{ fontSize: '0.8rem', maxWidth: 520, overflowWrap: 'anywhere' }}>{this.state.msg}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t('err.reload')}
        </button>
      </div>
    );
  }
}
