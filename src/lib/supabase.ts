import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True only when real (non-placeholder) credentials are present. */
export const isConfigured = Boolean(
  url && anonKey && !url.includes('YOUR-PROJECT') && !anonKey.includes('YOUR-PUBLIC'),
);

// Only the public anon key is ever used in the browser. Access is enforced by RLS.
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const BUCKET = 'surprise-media';

export const SITE_URL: string = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '');

export function requireClient(): SupabaseClient {
  if (!supabase) throw new AppError('err.notConfigured');
  return supabase;
}
