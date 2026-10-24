import { useI18n } from '../i18n';
import { isConfigured } from '../lib/supabase';

/** Shown whenever Supabase credentials are missing, so nothing pretends to be live. */
export function ConfigNotice() {
  const { t } = useI18n();
  if (isConfigured) return null;
  return (
    <div className="notice" role="note">
      <strong>{t('cfg.title')}</strong>
      <p>{t('cfg.body')}</p>
      <p className="notice-steps" dir="ltr">
        {t('cfg.steps')}
      </p>
    </div>
  );
}
