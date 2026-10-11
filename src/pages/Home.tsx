import { Link } from 'react-router-dom';
import { useI18n, type TKey } from '../i18n';
import { THEMES } from '../types';

const FEATURES: [string, TKey, TKey][] = [
  ['📸', 'home.f1t', 'home.f1d'],
  ['⏳', 'home.f2t', 'home.f2d'],
  ['💌', 'home.f3t', 'home.f3d'],
  ['🎵', 'home.f4t', 'home.f4d'],
  ['🔒', 'home.f5t', 'home.f5d'],
  ['🎁', 'home.f6t', 'home.f6d'],
  ['🎮', 'g.title', 'g.sub'],
];

export default function Home() {
  const { t } = useI18n();
  return (
    <>
      <section className="hero container">
        <p className="eyebrow">{t('home.eyebrow')}</p>
        <h1 className="hero-title">{t('home.title')}</h1>
        <p className="hero-sub">{t('home.subtitle')}</p>
        <div className="hero-cta">
          <Link to="/create" className="btn btn-primary btn-lg">
            {t('home.cta')}
          </Link>
          <a href="#examples" className="btn btn-ghost btn-lg">
            {t('home.ctaSecondary')}
          </a>
        </div>
        <ul className="stats">
          <li>🔗 {t('home.stat1')}</li>
          <li>🌍 {t('home.stat2')}</li>
          <li>🎨 {t('home.stat3')}</li>
        </ul>
      </section>

      <section className="container section">
        <h2 className="section-title">{t('home.howTitle')}</h2>
        <div className="steps3">
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className="glass pad step3">
              <span className="step3-n">{n}</span>
              <h3>{t(`home.how${n}t` as TKey)}</h3>
              <p className="muted">{t(`home.how${n}d` as TKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section" id="examples">
        <h2 className="section-title">{t('home.examplesTitle')}</h2>
        <p className="section-sub">{t('home.examplesSub')}</p>
        <div className="examples">
          {THEMES.map((th) => (
            <article key={th} className={`glass example example-${th}`}>
              <div className="example-art" aria-hidden="true">
                <span>♥</span>
              </div>
              <h3>{t(`theme.${th}` as TKey)}</h3>
              <p className="muted">{t(`theme.${th}Desc` as TKey)}</p>
              <div className="row">
                <Link to={`/example/${th}`} className="btn btn-ghost btn-sm">
                  {t('home.viewExample')}
                </Link>
                <Link to={`/create?theme=${th}`} className="btn btn-primary btn-sm">
                  {t('home.useTheme')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">{t('home.featuresTitle')}</h2>
        <div className="features">
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="glass pad feature">
              <span className="feature-i" aria-hidden="true">{icon}</span>
              <h3>{t(title)}</h3>
              <p className="muted">{t(desc)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section final-cta glass pad">
        <h2>{t('home.finalTitle')}</h2>
        <p className="muted">{t('home.finalSub')}</p>
        <Link to="/create" className="btn btn-primary btn-lg">
          {t('home.cta')}
        </Link>
      </section>
    </>
  );
}
