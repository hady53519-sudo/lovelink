import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthForm } from '../components/AuthForm';
import { ConfigNotice } from '../components/ConfigNotice';
import { TextArea, TextField } from '../components/Field';
import { GamesEditor } from '../components/builder/GamesEditor';
import { PhotoManager } from '../components/builder/PhotoManager';
import { Modal } from '../components/Modal';
import { ShareScreen } from '../components/ShareScreen';
import { SurpriseView } from '../components/SurpriseView';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { useI18n, type TKey } from '../i18n';
import { toErrorKey } from '../lib/errors';
import { parseSongUrl, parseVideoUrl } from '../lib/media';
import { isConfigured } from '../lib/supabase';
import {
  LIMITS,
  STEP_COUNT,
  validatePassword,
  validatePublishable,
  validateStep,
  type FieldErrors,
} from '../lib/validation';
import { getSurprise, saveSurprise, setPublished, type PasswordChange } from '../services/surprises';
import {
  emptyContent,
  parseGames,
  THEMES,
  type Lang,
  type PhotoItem,
  type SurpriseContent,
  type Theme,
} from '../types';

const DRAFT_KEY = 'lovelink.draft.v1';
const STEP_KEYS: TKey[] = ['b.s0', 'b.s1', 'b.s2', 'b.s3', 'b.s4', 'b.s5', 'b.s6'];
const TIP_KEYS: TKey[] = ['b.tip0', 'b.tip1', 'b.tip2', 'b.tip3', 'b.tip4', 'b.tip5', 'b.tip6'];

function loadLocalDraft(fallbackLang: Lang, theme: Theme | null): SurpriseContent {
  const base = emptyContent(fallbackLang);
  if (theme) base.theme = theme;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return base;
    const s = JSON.parse(raw) as Partial<SurpriseContent>;
    return {
      ...base,
      ...s,
      theme: theme ?? (THEMES.includes(s.theme as Theme) ? (s.theme as Theme) : base.theme),
      lang: s.lang === 'ar' || s.lang === 'en' ? s.lang : base.lang,
      cards: Array.isArray(s.cards) ? s.cards.slice(0, LIMITS.maxCards) : [],
      timeline: Array.isArray(s.timeline) ? s.timeline.slice(0, LIMITS.maxTimeline) : [],
      games: parseGames(s.games),
    };
  } catch {
    return base;
  }
}

const hasText = (c: SurpriseContent) => Boolean(c.nameA || c.nameB || c.title || c.message);

export default function Builder() {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const themeParam = params.get('theme');
  const initialTheme = THEMES.includes(themeParam as Theme) ? (themeParam as Theme) : null;

  const [content, setContent] = useState<SurpriseContent>(() =>
    routeId ? emptyContent(lang) : loadLocalDraft(lang, initialTheme),
  );
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [id, setId] = useState<string | null>(routeId ?? null);
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [isProtected, setIsProtected] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState<TKey | undefined>();
  const [loading, setLoading] = useState(Boolean(routeId));
  const [loadError, setLoadError] = useState<TKey | null>(null);
  const [busy, setBusy] = useState<null | 'draft' | 'published' | 'unpublish'>(null);
  const [progress, setProgress] = useState<{ d: number; t: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const pendingStatus = useRef<'draft' | 'published'>('draft');
  const loadedFor = useRef<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // ---- load an existing surprise for editing
  const load = useCallback(
    async (target: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await getSurprise(target);
        loadedFor.current = target;
        setContent(res.record.content);
        setPhotos(res.photos);
        setSlug(res.record.slug);
        setStatus(res.record.status);
        setIsProtected(res.record.isProtected);
        setUsePassword(res.record.isProtected);
        setDirty(false);
      } catch (e) {
        setLoadError(toErrorKey(e) === 'err.generic' ? 'b.loadError' : toErrorKey(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!routeId) return;
    if (!isConfigured) {
      setLoading(false);
      setLoadError('err.notConfigured');
      return;
    }
    if (loadedFor.current === routeId) return; // already in memory (e.g. after first save)
    void load(routeId);
  }, [routeId, load]);

  // ---- keep an unsent text draft locally so a sign-up detour cannot lose the work
  useEffect(() => {
    if (routeId || id || !hasText(content)) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(content));
    } catch {
      /* ignore */
    }
  }, [content, routeId, id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t('b.unsavedLeave');
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, t]);

  // release object URLs when leaving
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => p.file && URL.revokeObjectURL(p.previewUrl));
    },
    [],
  );

  const patch = (p: Partial<SurpriseContent>) => {
    const next = { ...content, ...p };
    setContent(next);
    setDirty(true);
    // Once errors are showing, keep them in sync while the user fixes things.
    setErrors((prev) => (Object.keys(prev).length ? validateStep(next, step) : prev));
  };

  const changePhotos = (next: PhotoItem[]) => {
    setPhotos(next);
    setDirty(true);
  };

  // ---- navigation between steps
  const goNext = () => {
    const errs = validateStep(content, step);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.push('error', t('b.fixFields'));
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goTo = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- saving
  const passwordChange = (): PasswordChange => {
    if (usePassword && passwordValue) return { mode: 'set', value: passwordValue };
    if (!usePassword && isProtected) return { mode: 'remove' };
    return { mode: 'keep' };
  };

  const run = async (target: 'draft' | 'published', skipAuthCheck = false) => {
    if (!isConfigured) {
      toast.push('error', t('b.saveDisabled'));
      return;
    }

    // Validate on the client (the database re-validates everything).
    let problem: { step: number; errors: FieldErrors } | null = null;
    if (target === 'published') {
      problem = validatePublishable(content);
    } else {
      for (const s of [0, 1, 3, 4]) {
        const errs = Object.fromEntries(
          Object.entries(validateStep(content, s)).filter(([, v]) => v !== 'err.required' || s > 1),
        ) as FieldErrors;
        if (Object.keys(errs).length) {
          problem = { step: s, errors: errs };
          break;
        }
      }
    }
    let pwErr: TKey | undefined;
    if (usePassword) {
      if (passwordValue) pwErr = validatePassword(passwordValue) ?? undefined;
      else if (!isProtected) pwErr = 'err.required';
    }
    setPasswordError(pwErr);
    if (problem || pwErr) {
      setErrors(problem?.errors ?? {});
      goTo(problem ? problem.step : 5);
      toast.push('error', t('b.fixFields'));
      return;
    }

    if (!user && !skipAuthCheck) {
      pendingStatus.current = target;
      setAuthOpen(true);
      toast.push('info', t('auth.needLogin'));
      return;
    }

    setBusy(target);
    setProgress(null);
    try {
      const res = await saveSurprise(
        { id, content, status: target, photos, password: passwordChange() },
        {
          onCreated: (newId, newSlug) => {
            setId(newId);
            setSlug(newSlug);
          },
          onProgress: (d, total) => setProgress({ d, t: total }),
        },
      );
      photos.forEach((p) => p.file && URL.revokeObjectURL(p.previewUrl));
      loadedFor.current = res.record.id;
      setPhotos(res.photos);
      setContent(res.record.content);
      setId(res.record.id);
      setSlug(res.record.slug);
      setStatus(res.record.status);
      setIsProtected(res.record.isProtected);
      setUsePassword(res.record.isProtected);
      setPasswordValue('');
      setDirty(false);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      if (!routeId) nav(`/edit/${res.record.id}`, { replace: true });
      if (target === 'published') setShared(true);
      else toast.push('success', status === 'published' ? t('b.savedChanges') : t('b.saved'));
    } catch (e) {
      toast.push('error', t(toErrorKey(e)));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const unpublish = async () => {
    if (!id) return;
    setBusy('unpublish');
    try {
      await setPublished(id, false);
      setStatus('draft');
      setShared(false);
      toast.push('success', t('b.unpublished'));
    } catch (e) {
      toast.push('error', t(toErrorKey(e)));
    } finally {
      setBusy(null);
    }
  };

  // ---- preview data
  const viewPhotos = useMemo(
    () =>
      photos
        .filter((p) => p.kind === 'gallery' && p.previewUrl)
        .map((p) => ({ url: p.previewUrl, caption: p.caption })),
    [photos],
  );
  const bg = photos.find((p) => p.kind === 'background')?.previewUrl;

  const song = content.songUrl.trim() ? parseSongUrl(content.songUrl) : null;
  const video = content.videoUrl.trim() ? parseVideoUrl(content.videoUrl) : null;

  if (loading) {
    return (
      <div className="container page center">
        <div className="spinner" role="status" aria-label={t('common.loading')} />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="container page narrow center">
        <ConfigNotice />
        <p className="error-box">{t(loadError)}</p>
        <div className="row">
          {routeId && isConfigured && (
            <button type="button" className="btn btn-ghost" onClick={() => void load(routeId)}>
              {t('common.retry')}
            </button>
          )}
          <Link className="btn btn-primary" to="/my">
            {t('nav.myPages')}
          </Link>
        </div>
      </div>
    );
  }
  if (shared && slug) {
    return (
      <div className="container page narrow">
        <div className="glass pad">
          <ShareScreen slug={slug} id={id ?? undefined} isProtected={isProtected} onEdit={() => setShared(false)} />
        </div>
      </div>
    );
  }

  const isPublished = status === 'published';
  const saving = busy !== null;

  return (
    <div className="container page builder">
      <div className="builder-head">
        <h1>{routeId ? t('b.editTitle') : t('b.title')}</h1>
        <p className="muted">{t('b.stepOf', { n: step + 1, total: STEP_COUNT })}</p>
      </div>
      <ConfigNotice />

      <ol className="stepper" aria-label={t('a11y.progress')}>
        {STEP_KEYS.map((k, i) => (
          <li key={k}>
            <button
              type="button"
              className={`step-chip ${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => (i <= step ? goTo(i) : goNext())}
            >
              <span className="step-n">{i < step ? '✓' : i + 1}</span>
              <span className="step-l">{t(k)}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="builder-grid">
        <section className="builder-form glass" aria-labelledby="step-title">
          <h2 id="step-title">{t(STEP_KEYS[step])}</h2>
          <p className="tip">💡 {t(TIP_KEYS[step])}</p>

          {step === 0 && (
            <>
              <div className="field">
                <span className="label">{t('f.lang')}</span>
                <div className="seg" role="radiogroup" aria-label={t('f.lang')}>
                  {(['en', 'ar'] as Lang[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={content.lang === l}
                      className={content.lang === l ? 'is-on' : ''}
                      onClick={() => patch({ lang: l })}
                    >
                      {l === 'ar' ? 'العربية' : 'English'}
                    </button>
                  ))}
                </div>
                <p className="hint">{t('f.langHint')}</p>
              </div>
              <div className="grid-2">
                <TextField label={t('f.nameA')} value={content.nameA} onChange={(v) => patch({ nameA: v })} placeholder={t('f.nameAPh')} maxLength={LIMITS.name} error={errors.nameA} />
                <TextField label={t('f.nameB')} value={content.nameB} onChange={(v) => patch({ nameB: v })} placeholder={t('f.nameBPh')} maxLength={LIMITS.name} error={errors.nameB} />
              </div>
              <TextField label={t('f.title')} value={content.title} onChange={(v) => patch({ title: v })} placeholder={t('f.titlePh')} maxLength={LIMITS.title} error={errors.title} />
            </>
          )}

          {step === 1 && (
            <TextArea
              label={t('f.message')}
              rows={12}
              value={content.message}
              onChange={(v) => patch({ message: v })}
              placeholder={t('f.messagePh')}
              counter={{ value: content.message.length, max: LIMITS.message }}
              error={errors.message}
            />
          )}

          {step === 2 && <PhotoManager photos={photos} onChange={changePhotos} />}

          {step === 3 && (
            <>
              <TextField
                label={t('f.song')}
                type="url"
                dir="ltr"
                value={content.songUrl}
                onChange={(v) => patch({ songUrl: v })}
                placeholder={t('f.songPh')}
                hint={song ? t('f.mediaOk', { provider: song.provider }) : t('f.songHint')}
                optional
                error={errors.songUrl}
              />
              <TextField
                label={t('f.video')}
                type="url"
                dir="ltr"
                value={content.videoUrl}
                onChange={(v) => patch({ videoUrl: v })}
                placeholder={t('f.videoPh')}
                hint={video ? t('f.mediaOk', { provider: video.provider }) : t('f.videoHint')}
                optional
                error={errors.videoUrl}
              />
            </>
          )}

          {step === 4 && (
            <>
              <fieldset className="group">
                <legend>{t('f.date')}</legend>
                <p className="hint">{t('f.dateHint')}</p>
                <div className="grid-2">
                  <TextField label={t('f.date')} type="date" dir="ltr" value={content.specialDate} onChange={(v) => patch({ specialDate: v })} optional error={errors.specialDate} />
                  <TextField label={t('f.dateLabel')} value={content.specialDateLabel} onChange={(v) => patch({ specialDateLabel: v })} placeholder={t('f.dateLabelPh')} maxLength={LIMITS.dateLabel} optional error={errors.specialDateLabel} />
                </div>
              </fieldset>

              <fieldset className="group">
                <legend>{t('f.cards')}</legend>
                <p className="hint">{t('f.cardsHint', { max: LIMITS.maxCards })}</p>
                {content.cards.map((card, i) => (
                  <div key={i} className="repeat glass">
                    <div className="repeat-head">
                      <strong>{t('f.card', { n: i + 1 })}</strong>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => patch({ cards: content.cards.filter((_, j) => j !== i) })}>{t('f.remove')}</button>
                    </div>
                    <TextField label={t('f.cardFront')} value={card.front} maxLength={LIMITS.cardFront} onChange={(v) => patch({ cards: content.cards.map((c, j) => (j === i ? { ...c, front: v } : c)) })} error={errors[`card${i}`]} />
                    <TextArea label={t('f.cardBack')} rows={2} value={card.back} maxLength={LIMITS.cardBack} onChange={(v) => patch({ cards: content.cards.map((c, j) => (j === i ? { ...c, back: v } : c)) })} />
                  </div>
                ))}
                <button type="button" className="btn btn-ghost" disabled={content.cards.length >= LIMITS.maxCards} onClick={() => patch({ cards: [...content.cards, { front: '', back: '' }] })}>
                  + {t('f.addCard')}
                </button>
              </fieldset>

              <fieldset className="group">
                <legend>{t('f.timeline')}</legend>
                <p className="hint">{t('f.timelineHint', { max: LIMITS.maxTimeline })}</p>
                {content.timeline.map((item, i) => (
                  <div key={i} className="repeat glass">
                    <div className="repeat-head">
                      <strong>{t('f.memory', { n: i + 1 })}</strong>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => patch({ timeline: content.timeline.filter((_, j) => j !== i) })}>{t('f.remove')}</button>
                    </div>
                    <div className="grid-2">
                      <TextField label={t('f.tlDate')} value={item.date} placeholder={t('f.tlDatePh')} maxLength={LIMITS.tlDate} onChange={(v) => patch({ timeline: content.timeline.map((x, j) => (j === i ? { ...x, date: v } : x)) })} />
                      <TextField label={t('f.tlTitle')} value={item.title} maxLength={LIMITS.tlTitle} onChange={(v) => patch({ timeline: content.timeline.map((x, j) => (j === i ? { ...x, title: v } : x)) })} error={errors[`tl${i}`]} />
                    </div>
                    <TextArea label={t('f.tlText')} rows={2} value={item.text} maxLength={LIMITS.tlText} onChange={(v) => patch({ timeline: content.timeline.map((x, j) => (j === i ? { ...x, text: v } : x)) })} />
                  </div>
                ))}
                <button type="button" className="btn btn-ghost" disabled={content.timeline.length >= LIMITS.maxTimeline} onClick={() => patch({ timeline: [...content.timeline, { date: '', title: '', text: '' }] })}>
                  + {t('f.addMemory')}
                </button>
              </fieldset>

              <GamesEditor games={content.games} lang={content.lang} errors={errors} onChange={(g) => patch({ games: g })} />

              <fieldset className="group">
                <legend>{t('f.finalButton')}</legend>
                <TextField label={t('f.finalButton')} value={content.finalButtonLabel} onChange={(v) => patch({ finalButtonLabel: v })} placeholder={t('f.finalButtonPh')} maxLength={LIMITS.finalButton} optional error={errors.finalButtonLabel} />
                <TextArea label={t('f.finalMessage')} rows={3} value={content.finalMessage} onChange={(v) => patch({ finalMessage: v })} hint={t('f.finalHint')} maxLength={LIMITS.finalMessage} optional error={errors.finalMessage} />
              </fieldset>
            </>
          )}

          {step === 5 && (
            <>
              <fieldset className="group">
                <legend>{t('f.theme')}</legend>
                <div className="theme-grid" role="radiogroup" aria-label={t('f.theme')}>
                  {THEMES.map((th) => (
                    <button
                      key={th}
                      type="button"
                      role="radio"
                      aria-checked={content.theme === th}
                      className={`theme-card theme-${th} ${content.theme === th ? 'is-on' : ''}`}
                      onClick={() => patch({ theme: th })}
                    >
                      <strong>{t(`theme.${th}` as TKey)}</strong>
                      <small>{t(`theme.${th}Desc` as TKey)}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="group">
                <legend>{t('f.password')}</legend>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={(e) => {
                      setUsePassword(e.target.checked);
                      setDirty(true);
                      if (!e.target.checked) {
                        setPasswordValue('');
                        setPasswordError(undefined);
                      }
                    }}
                  />
                  <span>{t('f.passwordHint')}</span>
                </label>
                {usePassword && (
                  <>
                    <TextField
                      label={t('f.password')}
                      type="password"
                      dir="ltr"
                      autoComplete="new-password"
                      value={passwordValue}
                      onChange={(v) => {
                        setPasswordValue(v);
                        setDirty(true);
                        setPasswordError(undefined);
                      }}
                      placeholder={t('f.passwordPh')}
                      maxLength={LIMITS.passwordMax}
                      hint={isProtected ? t('f.passwordCurrent') : passwordValue ? t('f.passwordPending') : undefined}
                      error={passwordError}
                    />
                    <p className="hint">{t('f.passwordShare')}</p>
                    {photos.length > 0 && <p className="notice notice-soft">{t('f.passwordNeedsFn')}</p>}
                  </>
                )}
              </fieldset>
            </>
          )}

          {step === 6 && (
            <>
              <h3>{t('b.reviewTitle')}</h3>
              <p className="muted">{t('b.reviewHint')}</p>
              <ul className="checklist">
                <li className={content.nameA && content.nameB && content.title ? 'ok' : 'todo'}>{t('b.checkNames')}</li>
                <li className={content.message ? 'ok' : 'todo'}>{t('b.checkMessage')}</li>
                <li className="ok">{t('b.checkPhotos', { n: photos.filter((p) => p.kind === 'gallery').length })}</li>
                <li className={song || video ? 'ok' : 'opt'}>{t('b.checkMedia')}</li>
                <li className="ok">{t('b.checkTheme', { theme: t(`theme.${content.theme}` as TKey) })}</li>
                <li className={usePassword ? 'ok' : 'opt'}>
                  {t('b.checkPrivacy')}: {usePassword ? t('b.on') : t('b.off')}
                </li>
              </ul>
            </>
          )}

          {progress && progress.t > 0 && (
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.t} aria-valuenow={progress.d}>
              <div style={{ width: `${(progress.d / progress.t) * 100}%` }} />
              <span>{t('b.uploading', { done: Math.min(progress.d + 1, progress.t), total: progress.t })}</span>
            </div>
          )}

          <div className="builder-actions">
            <button type="button" className="btn btn-ghost" onClick={() => goTo(Math.max(0, step - 1))} disabled={step === 0 || saving}>
              {t('common.back')}
            </button>
            <div className="builder-actions-right">
              <button type="button" className="btn btn-ghost" onClick={() => void run('draft')} disabled={saving}>
                {busy === 'draft' ? t('b.saving') : isPublished ? t('b.updatePublished') : t('b.saveDraft')}
              </button>
              {step < STEP_COUNT - 1 ? (
                <button type="button" className="btn btn-primary" onClick={goNext} disabled={saving}>
                  {t('common.next')}
                </button>
              ) : isPublished ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => void run('published')} disabled={saving}>
                    {busy === 'published' ? t('b.publishing') : t('b.updatePublished')}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => void unpublish()} disabled={saving}>
                    {t('b.unpublish')}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => void run('published')} disabled={saving}>
                  {busy === 'published' ? t('b.publishing') : t('b.publish')}
                </button>
              )}
            </div>
          </div>
          {isPublished && slug && step === STEP_COUNT - 1 && (
            <p className="muted">
              <button type="button" className="link" onClick={() => setShared(true)}>
                {t('share.title')} →
              </button>
            </p>
          )}
        </section>

        <aside className={`builder-preview ${showPreview ? 'is-open' : ''}`} aria-label={t('b.previewTitle')}>
          <div className="preview-head">
            <strong>{t('b.previewTitle')}</strong>
            <small>{t('b.previewNote')}</small>
          </div>
          <div className="preview-frame">
            <SurpriseView content={content} photos={viewPhotos} background={bg} mode="preview" />
          </div>
        </aside>
      </div>

      <button type="button" className="btn btn-primary preview-toggle" onClick={() => setShowPreview((s) => !s)}>
        {showPreview ? t('b.hidePreview') : t('b.showPreview')}
      </button>

      {authOpen && (
        <Modal title={t('auth.needLogin')} onClose={() => setAuthOpen(false)}>
          <AuthForm
            onSuccess={() => {
              setAuthOpen(false);
              void run(pendingStatus.current, true);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
