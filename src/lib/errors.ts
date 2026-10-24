import type { TKey } from '../i18n';

/** An error whose message is a translation key, safe to show to the user. */
export class AppError extends Error {
  key: TKey;
  constructor(key: TKey) {
    super(key);
    this.key = key;
  }
}

/** Maps any thrown value (Supabase, network, our own) to a translated message key. */
export function toErrorKey(e: unknown): TKey {
  if (e instanceof AppError) return e.key;
  const err = e as { message?: string; status?: number; code?: string } | null;
  const msg = (err?.message ?? '').toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
    return 'err.network';
  }
  if (msg.includes('surprise_limit_reached')) return 'err.limit';
  if (msg.includes('gallery_limit_reached')) return 'err.tooMany';
  if (msg.includes('invalid login credentials')) return 'err.authInvalid';
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'err.authExists';
  if (msg.includes('password should be') || msg.includes('weak_password')) return 'err.authWeak';
  if (err?.status === 429 || msg.includes('rate limit') || msg.includes('too many')) return 'err.authRate';
  if (err?.code === '42501' || err?.status === 403 || msg.includes('row-level security')) return 'err.forbidden';
  return 'err.generic';
}
