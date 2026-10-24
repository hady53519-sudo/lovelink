export type MediaProvider = 'youtube' | 'spotify' | 'vimeo';

export interface ParsedMedia {
  provider: MediaProvider;
  /** Official embed URL (no autoplay). */
  embedUrl: string;
  /** Canonical page URL, used as the fallback link. */
  openUrl: string;
  /** Spotify items are audio-only; YouTube/Vimeo are video players. */
  kind: 'audio' | 'video';
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const NUM_ID = /^\d{6,12}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{10,30}$/;

function toUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

function host(u: URL): string {
  return u.hostname.toLowerCase().replace(/^(www|m|music|open)\./, '');
}

function parseYouTube(u: URL): ParsedMedia | null {
  const h = host(u);
  let id: string | null = null;
  if (h === 'youtu.be') {
    id = u.pathname.split('/')[1] ?? null;
  } else if (h === 'youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/);
      if (m) id = m[2];
    }
  }
  if (!id || !YT_ID.test(id)) return null;
  return {
    provider: 'youtube',
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    openUrl: `https://www.youtube.com/watch?v=${id}`,
    kind: 'video',
  };
}

function parseSpotify(u: URL): ParsedMedia | null {
  if (host(u) !== 'spotify.com') return null;
  const parts = u.pathname.split('/').filter(Boolean);
  // Optional locale prefix such as /intl-ar/
  const rest = parts[0]?.startsWith('intl-') ? parts.slice(1) : parts;
  const [type, id] = rest;
  if (!type || !id) return null;
  if (!['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(type)) return null;
  if (!SPOTIFY_ID.test(id)) return null;
  return {
    provider: 'spotify',
    embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
    openUrl: `https://open.spotify.com/${type}/${id}`,
    kind: 'audio',
  };
}

function parseVimeo(u: URL): ParsedMedia | null {
  if (host(u) !== 'vimeo.com') return null;
  const id = u.pathname.split('/').filter(Boolean).find((p) => NUM_ID.test(p));
  if (!id) return null;
  return {
    provider: 'vimeo',
    embedUrl: `https://player.vimeo.com/video/${id}`,
    openUrl: `https://vimeo.com/${id}`,
    kind: 'video',
  };
}

/** Songs: YouTube or Spotify only. Returns null for anything else. */
export function parseSongUrl(raw: string): ParsedMedia | null {
  const u = toUrl(raw);
  if (!u) return null;
  return parseYouTube(u) ?? parseSpotify(u);
}

/** Videos: YouTube or Vimeo only. */
export function parseVideoUrl(raw: string): ParsedMedia | null {
  const u = toUrl(raw);
  if (!u) return null;
  return parseYouTube(u) ?? parseVimeo(u);
}
