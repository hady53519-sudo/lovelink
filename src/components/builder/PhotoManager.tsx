import { useRef } from 'react';
import { useToast } from '../Toast';
import { useI18n } from '../../i18n';
import { ALLOWED_IMAGE_TYPES, MAX_GALLERY_PHOTOS, checkImageFile } from '../../lib/files';
import { LIMITS } from '../../lib/validation';
import type { PhotoItem, PhotoKind } from '../../types';

interface Props {
  photos: PhotoItem[];
  onChange: (next: PhotoItem[]) => void;
}

const ACCEPT = ALLOWED_IMAGE_TYPES.join(',');

export function PhotoManager({ photos, onChange }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const galleryInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);

  const gallery = photos.filter((p) => p.kind === 'gallery');
  const background = photos.find((p) => p.kind === 'background');

  const release = (p: PhotoItem) => {
    if (p.file) URL.revokeObjectURL(p.previewUrl);
  };

  const addFiles = async (files: FileList | null, kind: PhotoKind) => {
    if (!files || files.length === 0) return;
    let current = photos;
    const room = kind === 'gallery' ? MAX_GALLERY_PHOTOS - gallery.length : 1;
    const list = Array.from(files);
    if (kind === 'gallery' && list.length > room) toast.push('error', t('err.tooMany'));

    for (const file of list.slice(0, Math.max(room, kind === 'background' ? 1 : 0))) {
      const check = await checkImageFile(file);
      if (check.error) {
        toast.push('error', `${file.name}: ${t(check.error)}`);
        continue;
      }
      if (kind === 'background') {
        const old = current.find((p) => p.kind === 'background');
        if (old) release(old);
        current = current.filter((p) => p.kind !== 'background');
      }
      current = [
        ...current,
        { id: crypto.randomUUID(), kind, caption: '', previewUrl: URL.createObjectURL(file), file },
      ];
    }
    onChange(current);
  };

  const remove = (p: PhotoItem) => {
    release(p);
    onChange(photos.filter((x) => x.id !== p.id));
  };

  const move = (p: PhotoItem, dir: -1 | 1) => {
    const idx = gallery.findIndex((x) => x.id === p.id);
    const target = idx + dir;
    if (target < 0 || target >= gallery.length) return;
    const reordered = [...gallery];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    onChange([...reordered, ...photos.filter((x) => x.kind !== 'gallery')]);
  };

  const setCaption = (p: PhotoItem, caption: string) =>
    onChange(photos.map((x) => (x.id === p.id ? { ...x, caption: caption.slice(0, LIMITS.caption) } : x)));

  return (
    <div className="photos">
      <section>
        <div className="section-head">
          <div>
            <h3>{t('f.gallery')}</h3>
            <p className="hint">{t('f.galleryHint', { max: MAX_GALLERY_PHOTOS })}</p>
          </div>
          <span className="chip">{t('f.photosCount', { n: gallery.length, max: MAX_GALLERY_PHOTOS })}</span>
        </div>
        <input
          ref={galleryInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void addFiles(e.target.files, 'gallery');
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn btn-ghost"
          disabled={gallery.length >= MAX_GALLERY_PHOTOS}
          onClick={() => galleryInput.current?.click()}
        >
          + {t('f.addPhotos')}
        </button>

        {gallery.length === 0 ? (
          <p className="empty">{t('f.photosEmpty')}</p>
        ) : (
          <ul className="photo-list">
            {gallery.map((p, i) => (
              <li key={p.id} className="photo-item glass">
                {p.previewUrl ? <img src={p.previewUrl} alt={p.caption || t('s.photoOf', { n: i + 1 })} /> : <div className="skeleton" />}
                <div className="photo-body">
                  <label className="sr-only" htmlFor={`cap-${p.id}`}>{t('f.caption')}</label>
                  <input
                    id={`cap-${p.id}`}
                    value={p.caption}
                    placeholder={t('f.captionPh')}
                    maxLength={LIMITS.caption}
                    onChange={(e) => setCaption(p, e.target.value)}
                  />
                  <div className="photo-actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => move(p, -1)} disabled={i === 0} aria-label={t('f.moveUp')}>↑</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => move(p, 1)} disabled={i === gallery.length - 1} aria-label={t('f.moveDown')}>↓</button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(p)}>{t('f.remove')}</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>{t('f.bg')} <span className="opt">({t('common.optional')})</span></h3>
        <p className="hint">{t('f.bgHint')}</p>
        <input
          ref={bgInput}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            void addFiles(e.target.files, 'background');
            e.target.value = '';
          }}
        />
        {background ? (
          <div className="bg-item glass">
            {background.previewUrl ? <img src={background.previewUrl} alt="" /> : <div className="skeleton" />}
            <div className="photo-actions">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => bgInput.current?.click()}>{t('f.replace')}</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(background)}>{t('f.remove')}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => bgInput.current?.click()}>
            + {t('f.addBg')}
          </button>
        )}
      </section>
    </div>
  );
}
