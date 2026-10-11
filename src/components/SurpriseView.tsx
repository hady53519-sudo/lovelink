import { useEffect, useMemo, useRef, useState } from 'react';
import { makeT } from '../i18n';
import { formatNumber } from '../lib/format';
import { parseSongUrl, parseVideoUrl } from '../lib/media';
import { daysSince, isValidDate } from '../lib/validation';
import type { SurpriseContent, ViewPhoto } from '../types';
import { EmbedPlayer } from './EmbedPlayer';
import { Arcade } from './games/Arcade';

interface Props {
  content: SurpriseContent;
  photos: ViewPhoto[];
  background?: string;
  /** 'public' = real visitor page, 'preview' = builder preview, 'example' = homepage demo. */
  mode: 'public' | 'preview' | 'example';
  photosNote?: string;
}

function Lightbox({ photo, onClose, label }: { photo: ViewPhoto; onClose: () => void; label: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <button ref={btn} type="button" className="lightbox-x" onClick={onClose} aria-label="×">
        ×
      </button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt={photo.caption} />
        {photo.caption && <figcaption>{photo.caption}</figcaption>}
      </figure>
    </div>
  );
}

/** Renders a surprise. Every value is rendered as React text (never as HTML), so user content cannot inject markup. */
export function SurpriseView({ content: c, photos, background, mode, photosNote }: Props) {
  const tt = useMemo(() => makeT(c.lang), [c.lang]);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState<ViewPhoto | null>(null);

  const song = c.songUrl.trim() ? parseSongUrl(c.songUrl) : null;
  const video = c.videoUrl.trim() ? parseVideoUrl(c.videoUrl) : null;
  const days = c.specialDate && isValidDate(c.specialDate) ? daysSince(c.specialDate) : null;

  let counter = '';
  if (days !== null) {
    if (days > 0) counter = days === 1 ? tt('s.together1') : tt('s.together', { n: formatNumber(days, c.lang) });
    else if (days < 0) counter = days === -1 ? tt('s.countdown1') : tt('s.countdown', { n: formatNumber(-days, c.lang) });
    else counter = tt('s.today');
  }

  const names = c.nameA.trim() && c.nameB.trim() ? `${c.nameA.trim()} ♥ ${c.nameB.trim()}` : c.nameA.trim() || c.nameB.trim();
  const empty = !names && !c.title.trim() && !c.message.trim();

  return (
    <article
      className={`sv sv-${c.theme}`}
      dir={c.lang === 'ar' ? 'rtl' : 'ltr'}
      lang={c.lang}
      style={background ? ({ ['--sv-bg' as string]: `url("${background}")` } as React.CSSProperties) : undefined}
    >
      {mode !== 'public' && (
        <div className="sv-banner">{mode === 'example' ? tt('s.exampleBanner') : tt('s.previewBanner')}</div>
      )}

      {empty ? (
        <div className="sv-empty">{tt('s.emptyPreview')}</div>
      ) : (
        <>
          <header className={`sv-hero ${background ? 'has-bg' : ''}`}>
            {names && <p className="sv-names">{names}</p>}
            {c.title.trim() && <h2 className="sv-title">{c.title}</h2>}
            {counter && (
              <p className="sv-counter">
                {c.specialDateLabel.trim() && <span>{c.specialDateLabel} · </span>}
                {counter}
              </p>
            )}
          </header>

          {c.message.trim() && (
            <section className="sv-section">
              <h3 className="sv-h">{tt('s.letter')}</h3>
              <div className="sv-letter">{c.message}</div>
            </section>
          )}

          {photos.length > 0 && (
            <section className="sv-section">
              <h3 className="sv-h">{tt('s.gallery')}</h3>
              <div className="sv-gallery">
                {photos.map((p, i) => (
                  <button
                    key={`${p.url}-${i}`}
                    type="button"
                    className="sv-photo"
                    onClick={() => setOpen(p)}
                    aria-label={`${tt('s.openPhoto')}: ${p.caption || tt('s.photoOf', { n: i + 1 })}`}
                  >
                    <img src={p.url} alt={p.caption || tt('s.photoOf', { n: i + 1 })} loading="lazy" />
                    {p.caption && <span>{p.caption}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}
          {photosNote && <p className="sv-note">{photosNote}</p>}

          {c.timeline.some((t) => t.title.trim()) && (
            <section className="sv-section">
              <h3 className="sv-h">{tt('s.timeline')}</h3>
              <ol className="sv-timeline">
                {c.timeline
                  .filter((t) => t.title.trim())
                  .map((t, i) => (
                    <li key={i}>
                      {t.date.trim() && <time>{t.date}</time>}
                      <strong>{t.title}</strong>
                      {t.text.trim() && <p>{t.text}</p>}
                    </li>
                  ))}
              </ol>
            </section>
          )}

          {c.cards.some((x) => x.front.trim() && x.back.trim()) && (
            <section className="sv-section">
              <h3 className="sv-h">{tt('s.cards')}</h3>
              <p className="sv-sub">{tt('s.tapFlip')}</p>
              <div className="sv-cards">
                {c.cards.map((card, i) =>
                  card.front.trim() && card.back.trim() ? (
                    <button
                      key={i}
                      type="button"
                      className={`flip ${flipped[i] ? 'is-flipped' : ''}`}
                      aria-pressed={!!flipped[i]}
                      onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
                    >
                      <span className="flip-inner">
                        <span className="flip-face flip-front">{card.front}</span>
                        <span className="flip-face flip-back">{card.back}</span>
                      </span>
                    </button>
                  ) : null,
                )}
              </div>
            </section>
          )}

          <Arcade games={c.games} tt={tt} />

          {song && (
            <section className="sv-section">
              <h3 className="sv-h">{tt('s.music')}</h3>
              <EmbedPlayer media={song} tt={tt} label="song" />
            </section>
          )}
          {video && (
            <section className="sv-section">
              <h3 className="sv-h">{tt('s.video')}</h3>
              <EmbedPlayer media={video} tt={tt} label="video" />
            </section>
          )}

          {c.finalMessage.trim() && (
            <section className="sv-section sv-final">
              {!revealed ? (
                <button type="button" className="btn btn-primary btn-lg" onClick={() => setRevealed(true)}>
                  {c.finalButtonLabel.trim() || tt('s.reveal')}
                </button>
              ) : (
                <div className="sv-reveal" role="status">
                  <div className="burst" aria-hidden="true">
                    {Array.from({ length: 12 }, (_, i) => (
                      <span key={i} style={{ ['--i' as string]: i }}>
                        {i % 2 ? '💖' : '✨'}
                      </span>
                    ))}
                  </div>
                  <p>{c.finalMessage}</p>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevealed(false)}>
                    {tt('s.revealClose')}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <footer className="sv-footer">
        <span>{tt('s.madeWith')}</span>
        {mode !== 'preview' && (
          <a href="/create" className="sv-create">
            {tt('s.createYours')}
          </a>
        )}
      </footer>

      {open && <Lightbox photo={open} onClose={() => setOpen(null)} label={tt('s.gallery')} />}
    </article>
  );
}
