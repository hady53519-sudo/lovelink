import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfigNotice } from '../components/ConfigNotice';
import { Modal } from '../components/Modal';
import { ShareScreen } from '../components/ShareScreen';
import { useToast } from '../components/Toast';
import { useI18n, type TKey } from '../i18n';
import { toErrorKey } from '../lib/errors';
import { formatDate } from '../lib/format';
import { isConfigured } from '../lib/supabase';
import { deleteSurprise, listSurprises, refreshPhotoUrls, type SurpriseSummary } from '../services/surprises';

export default function Dashboard() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState<SurpriseSummary[] | null>(null);
  const [error, setError] = useState<TKey | null>(null);
  const [toDelete, setToDelete] = useState<SurpriseSummary | null>(null);
  const [sharing, setSharing] = useState<SurpriseSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      setItems(await listSurprises());
      // Silent: keeps the photo links visitors use fresh (also fixes photos uploaded before this update).
      void refreshPhotoUrls().catch(() => 0);
    } catch (e) {
      const k = toErrorKey(e);
      setError(k === 'err.generic' ? 'dash.loadError' : k);
    }
  }, []);

  useEffect(() => {
    if (isConfigured) void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteSurprise(toDelete.id);
      setItems((xs) => (xs ?? []).filter((x) => x.id !== toDelete.id));
      toast.push('success', t('dash.deleted'));
      setToDelete(null);
    } catch (e) {
      toast.push('error', t(toErrorKey(e)));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container page">
      <div className="dash-head">
        <div>
          <h1>{t('dash.title')}</h1>
          <p className="muted">{t('dash.sub')}</p>
        </div>
        <Link to="/create" className="btn btn-primary">
          + {t('dash.new')}
        </Link>
      </div>

      <ConfigNotice />

      {error && (
        <div className="error-box" role="alert">
          <p>{t(error)}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {isConfigured && !error && items === null && <div className="spinner" role="status" aria-label={t('common.loading')} />}

      {items && items.length === 0 && (
        <div className="glass pad empty-state">
          <div aria-hidden="true" className="empty-i">💌</div>
          <h2>{t('dash.empty')}</h2>
          <p className="muted">{t('dash.emptyHint')}</p>
          <Link to="/create" className="btn btn-primary">
            {t('dash.new')}
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="dash-list">
          {items.map((s) => (
            <li key={s.id} className="glass pad dash-item">
              <div className="dash-main">
                <h3>{s.title || t('dash.untitled')}</h3>
                <p className="muted">
                  {[s.nameA, s.nameB].filter(Boolean).join(' ♥ ')}
                  {(s.nameA || s.nameB) && ' · '}
                  {t('dash.updated', { date: formatDate(s.updatedAt, lang) })}
                </p>
                <div className="badges">
                  <span className={`badge ${s.status === 'published' ? 'badge-on' : ''}`}>
                    {s.status === 'published' ? t('dash.published') : t('dash.draft')}
                  </span>
                  {s.isProtected && <span className="badge">🔒 {t('dash.protected')}</span>}
                  <span className="badge">{t(`theme.${s.theme}` as TKey)}</span>
                </div>
              </div>
              <div className="dash-actions">
                <Link className="btn btn-ghost btn-sm" to={`/edit/${s.id}`}>
                  {t('dash.edit')}
                </Link>
                {s.status === 'published' && (
                  <>
                    <a className="btn btn-ghost btn-sm" href={`/s/${s.slug}`} target="_blank" rel="noopener noreferrer">
                      {t('dash.view')}
                    </a>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSharing(s)}>
                      {t('dash.share')}
                    </button>
                  </>
                )}
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setToDelete(s)}>
                  {t('dash.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {toDelete && (
        <Modal title={t('dash.deleteTitle')} onClose={() => !deleting && setToDelete(null)}>
          <p>{t('dash.deleteBody')}</p>
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setToDelete(null)} disabled={deleting}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? t('common.loading') : t('common.delete')}
            </button>
          </div>
        </Modal>
      )}

      {sharing && (
        <Modal title={t('share.title')} onClose={() => setSharing(null)}>
          <ShareScreen slug={sharing.slug} id={sharing.id} isProtected={sharing.isProtected} />
        </Modal>
      )}
    </div>
  );
}
