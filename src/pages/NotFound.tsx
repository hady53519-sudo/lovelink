import { Link } from 'react-router-dom';
import { FloatingHearts, LangSwitcher } from '../components/Layout';
import { useI18n } from '../i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="center-screen notfound">
      <FloatingHearts />
      <div className="nf-lang">
        <LangSwitcher />
      </div>
      <div className="glass pad nf-card">
        <div className="nf-broken" aria-hidden="true">💔</div>
        <p className="nf-code" aria-hidden="true">404</p>
        <h1>{t('nf.title')}</h1>
        <p className="muted">{t('nf.body')}</p>
        <Link to="/" className="btn btn-primary">
          {t('nf.home')}
        </Link>
      </div>
    </div>
  );
}
