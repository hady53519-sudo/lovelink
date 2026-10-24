import { Component, type ReactNode } from 'react';
import { makeT } from '../i18n';

/** Last line of defence: a friendly screen instead of a blank page if rendering ever crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
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
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t('err.reload')}
        </button>
      </div>
    );
  }
}
