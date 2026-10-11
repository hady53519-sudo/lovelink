import { useRef, useState } from 'react';
import type { TFn, TKey } from '../../i18n';
import type { GamesConfig } from '../../types';

const GIVE_UP_AFTER = 7;

interface Props {
  cfg: GamesConfig['runaway'];
  tt: TFn;
}

/** "Do you love me?" — the No button runs away; after a few tries it gives up. */
export function RunawayGame({ cfg, tt }: Props) {
  const arena = useRef<HTMLDivElement>(null);
  const noBtn = useRef<HTMLButtonElement>(null);
  const [tries, setTries] = useState(0);
  const [won, setWon] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const question = cfg.question || tt('g.defQuestion');
  const yes = cfg.yes || tt('g.defYes');
  const no = cfg.no || tt('g.defNo');
  const win = cfg.win || tt('g.defWin');
  const gaveUp = tries >= GIVE_UP_AFTER;

  const flee = () => {
    const a = arena.current;
    const b = noBtn.current;
    if (!a || !b || gaveUp || won) return;
    const maxX = Math.max(a.clientWidth - b.offsetWidth, 0);
    const maxY = Math.max(a.clientHeight - b.offsetHeight, 0);
    setPos({ x: Math.random() * maxX, y: Math.random() * maxY });
    setTries((n) => n + 1);
  };

  if (won) {
    return (
      <div className="game-card game-win" role="status">
        <div className="burst" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ ['--i' as string]: i }}>
              {i % 2 ? '💖' : '💕'}
            </span>
          ))}
        </div>
        <p className="game-win-text">{win}</p>
      </div>
    );
  }

  const msgKey = (tries >= 1 && tries < GIVE_UP_AFTER ? `g.noMsg${Math.min(tries, 6)}` : null) as TKey | null;
  const message = gaveUp ? tt('g.noGaveUp') : msgKey ? tt(msgKey) : '';
  const scale = 1 + Math.min(tries, 8) * 0.07;

  return (
    <div className="game-card">
      <h4 className="game-q">{question}</h4>
      <div className="runaway-arena" ref={arena}>
        <button
          type="button"
          className="btn btn-primary runaway-yes"
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
          onClick={() => setWon(true)}
        >
          {yes}
        </button>
        <button
          type="button"
          ref={noBtn}
          className="btn btn-ghost runaway-no"
          style={pos ? { left: pos.x, top: pos.y } : { left: '62%', top: '58%' }}
          onPointerEnter={flee}
          onPointerDown={(e) => {
            if (!gaveUp) {
              e.preventDefault();
              flee();
            }
          }}
          onFocus={flee}
          onClick={() => {
            if (gaveUp) setWon(true);
            else flee();
          }}
        >
          {gaveUp ? yes : no}
        </button>
      </div>
      <p className="game-msg" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
