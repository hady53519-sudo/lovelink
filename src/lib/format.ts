import type { Lang } from '../types';

export function formatDate(iso: string, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatNumber(n: number, lang: Lang): string {
  try {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US').format(n);
  } catch {
    return String(n);
  }
}

/** Cryptographically random integer in [0, max). */
export function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

/** A pretty inline SVG "photo" used for examples, so no external images are needed. */
export function placeholderPhoto(seed: number): string {
  const palettes = [
    ['#ff5c93', '#9b5cff'],
    ['#ff8a5c', '#ff5c93'],
    ['#5c9bff', '#c45cff'],
    ['#ffb35c', '#ff5c7a'],
    ['#7a5cff', '#ff5ca8'],
    ['#ff5c8a', '#ffd15c'],
  ];
  const [a, b] = palettes[seed % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><path d="M200 220S120 170 120 120c0-25 18-42 42-42 17 0 30 9 38 24 8-15 21-24 38-24 24 0 42 17 42 42 0 50-80 100-80 100z" fill="rgba(255,255,255,.55)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
