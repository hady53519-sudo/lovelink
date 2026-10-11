import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../lib/errors';
import { checkImageFile, extensionFor } from '../lib/files';
import { BUCKET, requireClient } from '../lib/supabase';
import {
  cleanGames,
  parseGames,
  type GreetingCard,
  type Lang,
  type PhotoItem,
  type PhotoKind,
  type SurpriseContent,
  type SurpriseRecord,
  type Theme,
  type TimelineItem,
} from '../types';
import { signUrls } from './media';

export interface SurpriseSummary {
  id: string;
  slug: string;
  status: 'draft' | 'published';
  isProtected: boolean;
  updatedAt: string;
  title: string;
  nameA: string;
  nameB: string;
  theme: Theme;
}

export type PasswordChange = { mode: 'keep' } | { mode: 'set'; value: string } | { mode: 'remove' };

export interface SaveInput {
  id: string | null;
  content: SurpriseContent;
  status: 'draft' | 'published';
  photos: PhotoItem[];
  password: PasswordChange;
}

export interface SaveCallbacks {
  /** Called as soon as the row exists, so a retry after a failed upload will not create a duplicate. */
  onCreated?: (id: string, slug: string) => void;
  onProgress?: (done: number, total: number) => void;
}

export interface LoadedSurprise {
  record: SurpriseRecord;
  photos: PhotoItem[];
}

interface Row {
  id: string;
  slug: string;
  status: 'draft' | 'published';
  is_protected: boolean;
  published_at: string | null;
  updated_at: string;
  lang: Lang;
  name_a: string;
  name_b: string;
  title: string;
  message: string;
  theme: Theme;
  song_url: string | null;
  video_url: string | null;
  special_date: string | null;
  special_date_label: string;
  cards: GreetingCard[];
  timeline: TimelineItem[];
  games: unknown;
  final_button_label: string;
  final_message: string;
}

const SUMMARY_COLS = 'id, slug, status, is_protected, updated_at, title, name_a, name_b, theme';
const FULL_COLS =
  'id, slug, status, is_protected, published_at, updated_at, lang, name_a, name_b, title, message, theme, song_url, video_url, special_date, special_date_label, cards, timeline, games, final_button_label, final_message';

function rowToRecord(r: Row): SurpriseRecord {
  return {
    id: r.id,
    slug: r.slug,
    status: r.status,
    isProtected: r.is_protected,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    content: {
      lang: r.lang,
      nameA: r.name_a,
      nameB: r.name_b,
      title: r.title,
      message: r.message,
      theme: r.theme,
      songUrl: r.song_url ?? '',
      videoUrl: r.video_url ?? '',
      specialDate: r.special_date ?? '',
      specialDateLabel: r.special_date_label,
      cards: Array.isArray(r.cards) ? r.cards : [],
      timeline: Array.isArray(r.timeline) ? r.timeline : [],
      games: parseGames(r.games),
      finalButtonLabel: r.final_button_label,
      finalMessage: r.final_message,
    },
  };
}

function contentToRow(c: SurpriseContent) {
  return {
    lang: c.lang,
    name_a: c.nameA.trim(),
    name_b: c.nameB.trim(),
    title: c.title.trim(),
    message: c.message.trim(),
    theme: c.theme,
    song_url: c.songUrl.trim() || null,
    video_url: c.videoUrl.trim() || null,
    special_date: c.specialDate || null,
    special_date_label: c.specialDateLabel.trim(),
    cards: c.cards.map((x) => ({ front: x.front.trim(), back: x.back.trim() })),
    timeline: c.timeline.map((x) => ({ date: x.date.trim(), title: x.title.trim(), text: x.text.trim() })),
    games: cleanGames(c.games),
    final_button_label: c.finalButtonLabel.trim(),
    final_message: c.finalMessage.trim(),
  };
}

async function currentUserId(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new AppError('err.forbidden');
  return data.user.id;
}

export async function listSurprises(): Promise<SurpriseSummary[]> {
  const sb = requireClient();
  const { data, error } = await sb
    .from('surprises')
    .select(SUMMARY_COLS)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    status: r.status,
    isProtected: r.is_protected,
    updatedAt: r.updated_at,
    title: r.title,
    nameA: r.name_a,
    nameB: r.name_b,
    theme: r.theme,
  }));
}

export async function getSurprise(id: string): Promise<LoadedSurprise> {
  const sb = requireClient();
  const { data, error } = await sb.from('surprises').select(FULL_COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError('b.notYours');
  const record = rowToRecord(data as unknown as Row);

  const { data: photoRows, error: pe } = await sb
    .from('surprise_photos')
    .select('id, storage_path, kind, caption, position')
    .eq('surprise_id', id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (pe) throw pe;

  const rows = (photoRows ?? []) as unknown as {
    id: string;
    storage_path: string;
    kind: PhotoKind;
    caption: string;
  }[];
  let urls: Record<string, string> = {};
  try {
    urls = await signUrls(rows.map((r) => r.storage_path));
  } catch {
    /* previews fall back to empty; photos are still kept on save */
  }
  const photos: PhotoItem[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    caption: r.caption,
    previewUrl: urls[r.storage_path] ?? '',
    path: r.storage_path,
  }));
  return { record, photos };
}

async function syncPhotos(
  sb: SupabaseClient,
  uid: string,
  sid: string,
  photos: PhotoItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const { data: existing, error } = await sb
    .from('surprise_photos')
    .select('id, storage_path')
    .eq('surprise_id', sid);
  if (error) throw error;

  const keep = new Set(photos.filter((p) => p.path).map((p) => p.path as string));
  const removed = ((existing ?? []) as unknown as { id: string; storage_path: string }[]).filter(
    (r) => !keep.has(r.storage_path),
  );
  if (removed.length) {
    const rm = await sb.storage.from(BUCKET).remove(removed.map((r) => r.storage_path));
    if (rm.error) throw rm.error;
    const del = await sb.from('surprise_photos').delete().in('id', removed.map((r) => r.id));
    if (del.error) throw del.error;
  }

  const total = photos.filter((p) => p.file).length;
  let done = 0;
  onProgress?.(0, total);
  const position: Record<PhotoKind, number> = { gallery: 0, background: 0 };

  for (const p of photos) {
    const pos = position[p.kind]++;
    const caption = p.caption.trim().slice(0, 200);
    if (p.file) {
      // Re-validate right before upload: real type from magic bytes, size, non-empty.
      const check = await checkImageFile(p.file);
      if (check.error || !check.mime) throw new AppError(check.error ?? 'err.fileType');
      const path = `${uid}/${sid}/${crypto.randomUUID()}.${extensionFor(check.mime)}`;
      const up = await sb.storage
        .from(BUCKET)
        .upload(path, p.file, { contentType: check.mime, cacheControl: '3600', upsert: false });
      if (up.error) throw new AppError('err.upload');
      const ins = await sb.from('surprise_photos').insert({
        surprise_id: sid,
        owner_id: uid,
        storage_path: path,
        kind: p.kind,
        caption,
        position: pos,
        mime_type: check.mime,
        size_bytes: p.file.size,
      });
      if (ins.error) {
        await sb.storage.from(BUCKET).remove([path]);
        throw ins.error;
      }
      done += 1;
      onProgress?.(done, total);
    } else if (p.path) {
      const upd = await sb.from('surprise_photos').update({ caption, position: pos }).eq('storage_path', p.path);
      if (upd.error) throw upd.error;
    }
  }
}

export async function saveSurprise(input: SaveInput, cb: SaveCallbacks = {}): Promise<LoadedSurprise> {
  const sb = requireClient();
  const uid = await currentUserId(sb);
  const row = contentToRow(input.content);

  let id = input.id;
  if (!id) {
    const { data, error } = await sb
      .from('surprises')
      .insert({ ...row, owner_id: uid, status: 'draft' })
      .select('id, slug')
      .single();
    if (error) throw error;
    const created = data as unknown as { id: string; slug: string };
    id = created.id;
    cb.onCreated?.(created.id, created.slug);
  }

  await syncPhotos(sb, uid, id, input.photos, cb.onProgress);

  if (input.password.mode !== 'keep') {
    const { error } = await sb.rpc('set_surprise_password', {
      p_surprise_id: id,
      p_password: input.password.mode === 'set' ? input.password.value : null,
    });
    if (error) throw error;
  }

  // Content and status go last, so a failed upload never publishes a half-finished page.
  const { error } = await sb.from('surprises').update({ ...row, status: input.status }).eq('id', id);
  if (error) throw error;

  return getSurprise(id);
}

export async function setPublished(id: string, published: boolean): Promise<void> {
  const sb = requireClient();
  const { error } = await sb
    .from('surprises')
    .update({ status: published ? 'published' : 'draft' })
    .eq('id', id);
  if (error) throw error;
}

/** Deletes every uploaded file of the page, then the page itself (photo rows cascade). */
export async function deleteSurprise(id: string): Promise<void> {
  const sb = requireClient();
  const uid = await currentUserId(sb);
  const paths = new Set<string>();

  const { data: rows } = await sb.from('surprise_photos').select('storage_path').eq('surprise_id', id);
  for (const r of (rows ?? []) as unknown as { storage_path: string }[]) paths.add(r.storage_path);

  // Also sweep the folder, in case an earlier failed upload left an orphan file.
  const { data: files } = await sb.storage.from(BUCKET).list(`${uid}/${id}`, { limit: 200 });
  for (const f of files ?? []) paths.add(`${uid}/${id}/${f.name}`);

  if (paths.size) {
    const { error } = await sb.storage.from(BUCKET).remove(Array.from(paths));
    if (error) throw error;
  }
  const { error } = await sb.from('surprises').delete().eq('id', id);
  if (error) throw error;
}
