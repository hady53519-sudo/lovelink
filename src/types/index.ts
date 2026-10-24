export type Lang = 'en' | 'ar';
export type Theme = 'cute' | 'elegant' | 'cinematic' | 'minimal';
export const THEMES: Theme[] = ['cute', 'elegant', 'cinematic', 'minimal'];

export interface GreetingCard {
  front: string;
  back: string;
}

export interface TimelineItem {
  date: string;
  title: string;
  text: string;
}

export interface GamesConfig {
  runaway: { enabled: boolean; question: string; yes: string; no: string; win: string };
  coupons: { enabled: boolean; items: string[] };
  wheel: { enabled: boolean; items: string[] };
}

/** Everything the author edits (maps 1:1 to columns of `surprises`). */
export interface SurpriseContent {
  lang: Lang;
  nameA: string;
  nameB: string;
  title: string;
  message: string;
  theme: Theme;
  songUrl: string;
  videoUrl: string;
  specialDate: string; // YYYY-MM-DD or ''
  specialDateLabel: string;
  cards: GreetingCard[];
  timeline: TimelineItem[];
  games: GamesConfig;
  finalButtonLabel: string;
  finalMessage: string;
}

export type PhotoKind = 'gallery' | 'background';

/** A photo in the builder: either already stored (path) or pending upload (file). */
export interface PhotoItem {
  id: string;
  kind: PhotoKind;
  caption: string;
  previewUrl: string; // object URL (new) or signed URL (stored)
  file?: File;
  path?: string;
}

export interface SurpriseRecord {
  id: string;
  slug: string;
  status: 'draft' | 'published';
  isProtected: boolean;
  publishedAt: string | null;
  updatedAt: string;
  content: SurpriseContent;
}

export interface PublicPhoto {
  path: string;
  /** Signed URL delivered by the server (empty if missing/expired). */
  url: string;
  caption: string;
  kind: PhotoKind;
}

export interface PublicSurprise extends SurpriseContent {
  slug: string;
  isProtected: boolean;
  photos: PublicPhoto[];
}

export type PublicFetchStatus =
  | 'ok'
  | 'password_required'
  | 'wrong_password'
  | 'locked'
  | 'not_found';

export interface PublicFetchResult {
  status: PublicFetchStatus;
  surprise?: PublicSurprise;
  hint?: { lang: Lang; theme: Theme };
}

/** What the view component renders (media already resolved to URLs). */
export interface ViewPhoto {
  url: string;
  caption: string;
}

export function emptyGames(): GamesConfig {
  return {
    runaway: { enabled: false, question: '', yes: '', no: '', win: '' },
    coupons: { enabled: false, items: [] },
    wheel: { enabled: false, items: [] },
  };
}

export function emptyContent(lang: Lang = 'en'): SurpriseContent {
  return {
    lang,
    nameA: '',
    nameB: '',
    title: '',
    message: '',
    theme: 'elegant',
    songUrl: '',
    videoUrl: '',
    specialDate: '',
    specialDateLabel: '',
    cards: [],
    timeline: [],
    games: emptyGames(),
    finalButtonLabel: '',
    finalMessage: '',
  };
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const strList = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, maxItems).map((x) => x.slice(0, maxLen)) : [];
const bool = (v: unknown): boolean => v === true;

/** Defensive parse of the `games` jsonb coming from the database. */
export function parseGames(raw: unknown): GamesConfig {
  const g = emptyGames();
  if (!raw || typeof raw !== 'object') return g;
  const r = raw as Record<string, Record<string, unknown> | undefined>;
  const run = r.runaway ?? {};
  g.runaway = {
    enabled: bool(run.enabled),
    question: str(run.question, 120),
    yes: str(run.yes, 40),
    no: str(run.no, 40),
    win: str(run.win, 200),
  };
  g.coupons = { enabled: bool(r.coupons?.enabled), items: strList(r.coupons?.items, 8, 120) };
  g.wheel = { enabled: bool(r.wheel?.enabled), items: strList(r.wheel?.items, 8, 60) };
  return g;
}

/** Trim, drop blanks and cap lengths before saving. */
export function cleanGames(g: GamesConfig): GamesConfig {
  const clean = (items: string[], max: number) =>
    items.map((x) => x.trim().slice(0, max)).filter(Boolean).slice(0, 8);
  return {
    runaway: {
      enabled: g.runaway.enabled,
      question: g.runaway.question.trim().slice(0, 120),
      yes: g.runaway.yes.trim().slice(0, 40),
      no: g.runaway.no.trim().slice(0, 40),
      win: g.runaway.win.trim().slice(0, 200),
    },
    coupons: { enabled: g.coupons.enabled, items: clean(g.coupons.items, 120) },
    wheel: { enabled: g.wheel.enabled, items: clean(g.wheel.items, 60) },
  };
}
