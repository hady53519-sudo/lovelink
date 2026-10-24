import { useI18n, type TKey } from '../i18n';
import { formatDate } from '../lib/format';

const UPDATED = '2026-10-11';
const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim();

export function Privacy() {
  const { t, lang } = useI18n();
  const sections = [1, 2, 3, 4, 5, 6, 7] as const;
  return (
    <div className="container page narrow prose">
      <h1>{t('pr.title')}</h1>
      <p className="muted">{t('pr.updated', { date: formatDate(UPDATED, lang) })}</p>
      <p className="lead">{t('pr.intro')}</p>
      {sections.map((n) => (
        <section key={n}>
          <h2>{t(`pr.s${n}h` as TKey)}</h2>
          <p>{t(`pr.s${n}b` as TKey)}</p>
        </section>
      ))}
      <section>
        <h2>{t('pr.s8h')}</h2>
        <p>{CONTACT ? t('pr.s8b', { email: CONTACT }) : t('pr.s8bNone')}</p>
      </section>
    </div>
  );
}

export function Terms() {
  const { t, lang } = useI18n();
  const sections = [1, 2, 3, 4, 5, 6, 7] as const;
  return (
    <div className="container page narrow prose">
      <h1>{t('tm.title')}</h1>
      <p className="muted">{t('tm.updated', { date: formatDate(UPDATED, lang) })}</p>
      <p className="lead">{t('tm.intro')}</p>
      {sections.map((n) => (
        <section key={n}>
          <h2>{t(`tm.s${n}h` as TKey)}</h2>
          <p>{t(`tm.s${n}b` as TKey)}</p>
        </section>
      ))}
    </div>
  );
}
