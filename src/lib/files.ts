import type { TKey } from '../i18n';

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB (also enforced by the bucket)
export const MAX_GALLERY_PHOTOS = 12;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extensionFor(mime: string): string {
  return EXT[mime] ?? 'bin';
}

/** Detects the real image type from magic bytes (the browser-reported type can be spoofed). */
export async function sniffImageType(file: Blob): Promise<string | null> {
  const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';
  return null;
}

export interface FileCheck {
  error: TKey | null;
  mime: string | null;
}

export async function checkImageFile(file: File): Promise<FileCheck> {
  if (file.size === 0) return { error: 'err.fileEmpty', mime: null };
  if (file.size > MAX_FILE_BYTES) return { error: 'err.fileTooLarge', mime: null };
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { error: 'err.fileType', mime: null };
  }
  const real = await sniffImageType(file);
  if (!real || real !== file.type) return { error: 'err.fileType', mime: null };
  return { error: null, mime: real };
}
