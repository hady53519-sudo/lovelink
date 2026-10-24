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
  mode: 'public' | 'preview' | 'example' | 'showcase';
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
  // Public and example pages start with a closed-envelope screen; the builder preview does not.
  const gated = mode === 'public' || mode === 'example';
  const [opened, setOpened] = useState(!gated);
  const root = useRef<HTMLElement>(null);

  // Fade sections in as they scroll into view.
  useEffect(() => {
    if (!opened || !gated) return;
    const els = root.current?.querySelectorAll<HTMLElement>('.reveal');
    if (!els || els.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.1 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [opened, gated]);

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

  const themeStyle = background ? ({ ['--sv-bg' as string]: `url("${background}")` } as React.CSSProperties) : undefined;

  if (!opened) {
    const to = c.nameB.trim() || c.nameA.trim();
    return (
      <article className={`sv sv-${c.theme} sv-gate`} dir={c.lang === 'ar' ? 'rtl' : 'ltr'} lang={c.lang} style={themeStyle}>
        <div className="gate">
          <svg className="envelope" viewBox="0 0 120 90" aria-hidden="true">
            <rect x="6" y="14" width="108" height="70" rx="8" className="env-body" />
            <path d="M6 22 60 58 114 22" className="env-flap" fill="none" strokeWidth="3" strokeLinejoin="round" />
            <path d="M60 50s-14-9-14-19c0-6 4-9 8-9 3 0 5 2 6 4 1-2 3-4 6-4 4 0 8 3 8 9 0 10-14 19-14 19z" className="env-heart" />
          </svg>
          <p className="gate-sub">{tt('s.introSub')}</p>
          {to && <h2 className="gate-title">{tt('s.introFor', { name: to })}</h2>}
          {c.nameA.trim() && c.nameB.trim() && <p className="gate-from">{tt('s.introFrom', { name: c.nameA.trim() })}</p>}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              setOpened(true);
              window.scrollTo({ top: 0 });
            }}
          >
            {tt('s.introOpen')}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={root}
      data-anim={gated ? 'on' : 'off'}
      className={`sv sv-${c.theme}`}
      dir={c.lang === 'ar' ? 'rtl' : 'ltr'}
      lang={c.lang}
      style={themeStyle}
    >
      {(mode === 'preview' || mode === 'example') && (
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
            <section className="sv-section reveal">
              <h3 className="sv-h">{tt('s.letter')}</h3>
              <div className="sv-letter">{c.message}</div>
            </section>
          )}

          {photos.length > 0 && (
            <section className="sv-section reveal">
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
            <section className="sv-section reveal">
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
            <section className="sv-section reveal">
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
            <section className="sv-section reveal">
              <h3 className="sv-h">{tt('s.music')}</h3>
              <EmbedPlayer media={song} tt={tt} label="song" />
            </section>
          )}
          {video && (
            <section className="sv-section reveal">
              <h3 className="sv-h">{tt('s.video')}</h3>
              <EmbedPlayer media={video} tt={tt} label="video" />
            </section>
          )}

          {c.finalMessage.trim() && (
            <section className="sv-section sv-final reveal">
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

      {mode !== 'showcase' && (
        <footer className="sv-footer">
          <span>{tt('s.madeWith')}</span>
          {mode !== 'preview' && (
            <a href="/create" className="sv-create">
              {tt('s.createYours')}
            </a>
          )}
        </footer>
      )}

      {open && <Lightbox photo={open} onClose={() => setOpen(null)} label={tt('s.gallery')} />}
    </article>
  );
}
