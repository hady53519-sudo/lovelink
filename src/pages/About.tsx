import { Link } from 'react-router-dom';
import { DEVELOPER_CREDIT } from '../components/Layout';
import { useI18n } from '../i18n';

export default function About() {
  const { t } = useI18n();
  return (
    <div className="container page narrow prose">
      <h1>{t('about.title')}</h1>
      <p className="lead">{t('about.lead')}</p>
      <p>{t('about.p1')}</p>
      <p>{t('about.p2')}</p>

      <h2>{t('about.howTitle')}</h2>
      <ol>
        <li>{t('about.how1')}</li>
        <li>{t('about.how2')}</li>
        <li>{t('about.how3')}</li>
      </ol>

      <h2>{t('about.langTitle')}</h2>
      <p>{t('about.langBody')}</p>

      <div className="glass pad about-credit">
        <span className="muted">{t('about.creator')}</span>
        <strong className="credit" dir="ltr" lang="en">
          {DEVELOPER_CREDIT}
        </strong>
      </div>

      <p>
        <Link to="/create" className="btn btn-primary">
          {t('home.cta')}
        </Link>
      </p>
    </div>
  );
}
