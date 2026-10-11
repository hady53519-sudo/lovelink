import { useEffect, useRef, useState } from 'react';
import type { TFn } from '../../i18n';

const W = 600;
const H = 260;

function ScratchCard({ text, tt }: { text: string; tt: TFn }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const moves = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#f6d365');
    g.addColorStop(0.5, '#ffe9a8');
    g.addColorStop(1, '#e8b04a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.font = '700 34px sans-serif';
    ctx.fillStyle = 'rgba(120,70,0,.55)';
    ctx.textAlign = 'center';
    ctx.fillText('✨ ✨ ✨', W / 2, H / 2 + 12);
  }, []);

  const scratchAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 60;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    // Join consecutive points with a line so fast swipes do not leave gaps.
    ctx.moveTo(last.current?.x ?? x, last.current?.y ?? y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
    moves.current += 1;
    if (moves.current % 6 === 0) checkProgress();
  };

  const checkProgress = () => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const { data } = ctx.getImageData(0, 0, W, H);
    let cleared = 0;
    let total = 0;
    for (let y = 0; y < H; y += 10) {
      for (let x = 0; x < W; x += 10) {
        total += 1;
        if (data[(y * W + x) * 4 + 3] < 40) cleared += 1;
      }
    }
    if (cleared / total > 0.45) setRevealed(true);
  };

  return (
    <div className={`scratch ${revealed ? 'is-revealed' : ''}`}>
      <div className="scratch-prize" aria-live="polite">
        {text}
      </div>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="scratch-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          drawing.current = true;
          last.current = null;
          e.currentTarget.setPointerCapture(e.pointerId);
          scratchAt(e);
        }}
        onPointerMove={(e) => drawing.current && scratchAt(e)}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
          checkProgress();
        }}
        onPointerCancel={() => (drawing.current = false)}
      />
      {!revealed && <span className="scratch-hint">{tt('g.scratchHint')}</span>}
      {!revealed && (
        <button type="button" className="btn btn-ghost btn-sm scratch-reveal" onClick={() => setRevealed(true)}>
          {tt('g.revealNow')}
        </button>
      )}
    </div>
  );
}

export function CouponGame({ items, tt }: { items: string[]; tt: TFn }) {
  const [index, setIndex] = useState(0);
  const last = index >= items.length - 1;
  if (items.length === 0) return null;

  return (
    <div className="game-card">
      <h4 className="game-q">{tt('g.scratchTitle')}</h4>
      <p className="game-sub">{tt('g.couponOf', { n: index + 1, total: items.length })}</p>
      <ScratchCard key={index} text={items[index]} tt={tt} />
      {last ? (
        <p className="game-msg">{tt('g.couponsDone')}</p>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={() => setIndex((i) => i + 1)}>
          {tt('g.nextCoupon')}
        </button>
      )}
    </div>
  );
}
