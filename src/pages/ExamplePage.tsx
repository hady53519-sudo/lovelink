import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FloatingHearts, LangSwitcher } from '../components/Layout';
import { SurpriseView } from '../components/SurpriseView';
import { useI18n } from '../i18n';
import { exampleContent, examplePhotos } from '../lib/examples';
import { THEMES, type Theme } from '../types';
import NotFound from './NotFound';

export default function ExamplePage() {
  const { theme } = useParams();
  const { t, lang } = useI18n();
  const valid = THEMES.includes(theme as Theme);
  const content = useMemo(() => (valid ? exampleContent(theme as Theme, lang) : null), [valid, theme, lang]);
  const photos = useMemo(() => examplePhotos(lang), [lang]);

  if (!content) return <NotFound />;
  return (
    <div className="public-wrap">
      <FloatingHearts />
      <div className="example-bar glass">
        <Link to="/" className="btn btn-ghost btn-sm">
          ← {t('nf.home')}
        </Link>
        <LangSwitcher />
        <Link to={`/create?theme=${theme}`} className="btn btn-primary btn-sm">
          {t('home.useTheme')}
        </Link>
      </div>
      <SurpriseView content={content} photos={photos} mode="example" />
    </div>
  );
}
