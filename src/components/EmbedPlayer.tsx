import { useState } from 'react';
import type { TFn } from '../i18n';
import type { ParsedMedia } from '../lib/media';

const PROVIDER_NAME = { youtube: 'YouTube', spotify: 'Spotify', vimeo: 'Vimeo' } as const;

/**
 * Click-to-load embed. Nothing from the third party is loaded (and nothing plays) until the
 * visitor presses the button, and the iframe is sandboxed. A plain link is always available
 * as a fallback if the embed is blocked or unavailable.
 */
export function EmbedPlayer({ media, tt, label }: { media: ParsedMedia; tt: TFn; label: 'song' | 'video' }) {
  const [active, setActive] = useState(false);
  const provider = PROVIDER_NAME[media.provider];
  const height = media.provider === 'spotify' ? 152 : undefined;

  return (
    <div className={`embed embed-${media.kind}`}>
      {active ? (
        <iframe
          title={`${provider} ${label}`}
          src={media.embedUrl}
          width="100%"
          height={height}
          className={media.kind === 'video' ? 'embed-frame embed-16x9' : 'embed-frame'}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
      ) : (
        <button type="button" className="btn btn-primary embed-play" onClick={() => setActive(true)}>
          <span aria-hidden="true">▶</span> {label === 'song' ? tt('s.playSong') : tt('s.playVideo')}
        </button>
      )}
      <p className="embed-note">
        {active ? tt('s.embedHint') : ''}{' '}
        <a href={media.openUrl} target="_blank" rel="noopener noreferrer">
          {tt('s.openOn', { provider })}
        </a>
      </p>
    </div>
  );
}
