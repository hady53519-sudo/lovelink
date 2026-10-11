import { BUCKET, requireClient } from '../lib/supabase';

/** Signed URLs (1 hour) for private storage paths. RLS decides which paths the caller may sign. */
export async function signUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const sb = requireClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
