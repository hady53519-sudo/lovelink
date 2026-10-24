import { BUCKET, requireClient } from '../lib/supabase';

/** Lifetime of the photo links stored for visitors (1 year). The app renews them automatically. */
export const PHOTO_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

/** Signed URLs for private storage paths. RLS decides which paths the caller may sign (only the owner's). */
export async function signUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const sb = requireClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, expiresIn);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
