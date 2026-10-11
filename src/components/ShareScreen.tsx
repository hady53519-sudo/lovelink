import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { SITE_URL } from '../lib/supabase';
import { useToast } from './Toast';

interface Props {
  slug: string;
  id?: string;
  isProtected: boolean;
  /** Called by the "keep editing" button when the screen is shown inside the builder. */
  onEdit?: () => void;
}

export function shareUrl(slug: string): string {
  return `${SITE_URL}/s/${slug}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function ShareScreen({ slug, id, isProtected, onEdit }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const url = shareUrl(slug);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#120a1f', light: '#ffffff' } })
      .then((d) => active && setQr(d))
      .catch(() => active && setQr(''));
    return () => {
      active = false;
    };
  }, [url]);

  const copy = async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast.push('success', t('share.copied'));
      window.setTimeout(() => setCopied(false), 2500);
    } else {
      toast.push('error', t('share.copyFailed'));
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'LoveLink', text: t('share.text'), url });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="share">
      <div className="share-hearts" aria-hidden="true">
        💖
      </div>
      <h2>{t('share.title')}</h2>
      <p className="muted">{t('share.sub')}</p>

      <label className="share-label" htmlFor="share-link">
        {t('share.link')}
      </label>
      <div className="share-row">
        <input id="share-link" readOnly value={url} dir="ltr" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn btn-primary" onClick={copy}>
          {copied ? '✓ ' + t('share.copied') : t('share.copy')}
        </button>
      </div>
      <div className="share-actions">
        {canShare && (
          <button type="button" className="btn btn-ghost" onClick={nativeShare}>
            {t('share.native')}
          </button>
        )}
        <a className="btn btn-ghost" href={`/s/${slug}`} target="_blank" rel="noopener noreferrer">
          {t('share.view')}
        </a>
      </div>

      {isProtected && <p className="notice notice-soft">{t('share.passwordNote')}</p>}

      <div className="share-qr">
        <h3>{t('share.qr')}</h3>
        {qr ? <img src={qr} alt={`QR ${url}`} width={200} height={200} /> : <div className="skeleton" style={{ width: 200, height: 200 }} />}
        <p className="muted">{t('share.qrHint')}</p>
        {qr && (
          <a className="btn btn-ghost btn-sm" href={qr} download={`lovelink-${slug}.png`}>
            {t('share.downloadQr')}
          </a>
        )}
      </div>

      <div className="share-actions">
        {onEdit && (
          <button type="button" className="btn btn-ghost" onClick={onEdit}>
            {t('share.edit')}
          </button>
        )}
        {!onEdit && id && (
          <Link className="btn btn-ghost" to={`/edit/${id}`}>
            {t('dash.edit')}
          </Link>
        )}
        <Link className="btn btn-ghost" to="/my">
          {t('share.dash')}
        </Link>
      </div>
    </div>
  );
}
