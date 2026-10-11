import { requireClient } from '../lib/supabase';
import {
  parseGames,
  THEMES,
  type GreetingCard,
  type Lang,
  type PublicFetchResult,
  type PublicFetchStatus,
  type PublicPhoto,
  type PublicSurprise,
  type Theme,
  type TimelineItem,
} from '../types';
import { signUrls } from './media';

const s = (v: unknown, max = 5000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const asLang = (v: unknown): Lang => (v === 'ar' ? 'ar' : 'en');
const asTheme = (v: unknown): Theme => (THEMES as unknown[]).includes(v) ? (v as Theme) : 'elegant';

function parsePublic(raw: Record<string, unknown>): PublicSurprise {
  const cards: GreetingCard[] = Array.isArray(raw.cards)
    ? (raw.cards as Record<string, unknown>[]).slice(0, 6).map((c) => ({ front: s(c?.front, 200), back: s(c?.back, 600) }))
    : [];
  const timeline: TimelineItem[] = Array.isArray(raw.timeline)
    ? (raw.timeline as Record<string, unknown>[])
        .slice(0, 20)
        .map((t) => ({ date: s(t?.date, 40), title: s(t?.title, 100), text: s(t?.text, 600) }))
    : [];
  const photos: PublicPhoto[] = Array.isArray(raw.photos)
    ? (raw.photos as Record<string, unknown>[]).slice(0, 14).map((p) => ({
        path: s(p?.path, 300),
        caption: s(p?.caption, 200),
        kind: p?.kind === 'background' ? 'background' : 'gallery',
      }))
    : [];
  return {
    slug: s(raw.slug, 64),
    isProtected: raw.isProtected === true,
    lang: asLang(raw.lang),
    nameA: s(raw.nameA, 60),
    nameB: s(raw.nameB, 60),
    title: s(raw.title, 120),
    message: s(raw.message),
    theme: asTheme(raw.theme),
    songUrl: s(raw.songUrl, 500),
    videoUrl: s(raw.videoUrl, 500),
    specialDate: s(raw.specialDate, 10),
    specialDateLabel: s(raw.specialDateLabel, 80),
    cards,
    timeline,
    games: parseGames(raw.games),
    finalButtonLabel: s(raw.finalButtonLabel, 40),
    finalMessage: s(raw.finalMessage, 2000),
    photos,
  };
}

/** Public read path. The server decides what is returned; protected pages need the right password. */
export async function fetchPublic(slug: string, password?: string): Promise<PublicFetchResult> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('get_public_surprise', {
    p_slug: slug,
    p_password: password ?? null,
  });
  if (error) throw error;
  const d = data as { status: PublicFetchStatus; surprise?: Record<string, unknown> } | null;
  if (!d) return { status: 'not_found' };
  if (d.status === 'ok' && d.surprise) return { status: 'ok', surprise: parsePublic(d.surprise) };
  if (d.status === 'password_required' && d.surprise) {
    return { status: d.status, hint: { lang: asLang(d.surprise.lang), theme: asTheme(d.surprise.theme) } };
  }
  return { status: d.status };
}

export interface PhotoUrlResult {
  urls: Record<string, string>;
  /** 'setup' = the protected-media Edge Function is not deployed; 'failed' = other problem. */
  problem: null | 'setup' | 'failed';
}

/**
 * Unprotected pages: signed URLs straight from Storage (allowed by RLS for published pages).
 * Protected pages: the Edge Function re-checks the password server-side and returns signed URLs.
 */
export async function resolvePhotoUrls(
  page: PublicSurprise,
  password?: string,
): Promise<PhotoUrlResult> {
  const paths = page.photos.map((p) => p.path);
  if (paths.length === 0) return { urls: {}, problem: null };
  const sb = requireClient();
  try {
    if (!page.isProtected) {
      const urls = await signUrls(paths);
      return { urls, problem: Object.keys(urls).length < paths.length ? 'failed' : null };
    }
    const { data, error } = await sb.functions.invoke('protected-media', {
      body: { slug: page.slug, password: password ?? '' },
    });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      return { urls: {}, problem: status === 404 ? 'setup' : 'failed' };
    }
    const result = data as { status?: string; urls?: Record<string, string> } | null;
    if (result?.status !== 'ok') return { urls: {}, problem: 'failed' };
    return { urls: result.urls ?? {}, problem: null };
  } catch {
    return { urls: {}, problem: 'failed' };
  }
}
