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
        url: typeof p?.url === 'string' && p.url.startsWith('https://') ? p.url.slice(0, 1500) : '',
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
