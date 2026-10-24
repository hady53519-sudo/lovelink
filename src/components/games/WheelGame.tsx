import { useEffect, useRef, useState } from 'react';
import type { TFn } from '../../i18n';
import { randomInt } from '../../lib/format';

const COLORS = ['#ff5c93', '#9b5cff', '#ff7a7a', '#c45cff', '#ff8fb8', '#7a6cff', '#ff6b9e', '#b07cff'];

function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)]; // 0° = top, clockwise
}

function slicePath(i: number, n: number): string {
  const a0 = (i * 360) / n;
  const a1 = ((i + 1) * 360) / n;
  const [x0, y0] = polar(96, a0);
  const [x1, y1] = polar(96, a1);
  return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A96 96 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

const short = (s: string) => (s.length > 14 ? `${s.slice(0, 13)}…` : s);

export function WheelGame({ items, tt }: { items: string[]; tt: TFn }) {
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const n = items.length;

  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (n < 2) return null;

  const spin = () => {
    if (spinning) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const winner = randomInt(n);
    const slice = 360 / n;
    const jitter = (Math.random() - 0.5) * slice * 0.6;
    const centre = (winner + 0.5) * slice + jitter;
    const base = rot - (((rot % 360) + 360) % 360);
    const next = base + 360 * (reduce ? 1 : 5) + (360 - centre);
    setResult(null);
    setSpinning(true);
    setRot(next);
    timer.current = window.setTimeout(
      () => {
        setSpinning(false);
        setResult(items[winner]);
      },
      reduce ? 300 : 4200,
    );
  };

  return (
    <div className="game-card">
      <h4 className="game-q">{tt('g.wheelLabel')}</h4>
      <div className="wheel-wrap">
        <div className="wheel-pointer" aria-hidden="true">
          ▼
        </div>
        <svg
          viewBox="-100 -100 200 200"
          className="wheel"
          role="img"
          aria-label={tt('g.wheelLabel')}
          style={{ transform: `rotate(${rot}deg)`, transition: spinning ? undefined : 'none' }}
          data-spinning={spinning}
        >
          {items.map((label, i) => {
            const mid = ((i + 0.5) * 360) / n;
            const [tx, ty] = polar(58, mid);
            return (
              <g key={i}>
                <path d={slicePath(i, n)} fill={COLORS[i % COLORS.length]} stroke="#120a1f" strokeWidth="1.2" />
                <text
                  x={tx}
                  y={ty}
                  fill="#fff"
                  fontSize="7"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid - 90} ${tx} ${ty})`}
                >
                  {short(label)}
                </text>
              </g>
            );
          })}
          <circle r="9" fill="#120a1f" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
      <button type="button" className="btn btn-primary" onClick={spin} disabled={spinning}>
        {spinning ? tt('g.spinning') : result ? tt('g.spinAgain') : tt('g.spin')}
      </button>
      <p className="game-result" aria-live="polite">
        {result && (
          <>
            <span className="game-sub">{tt('g.youGot')}</span>
            <strong>{result}</strong>
          </>
        )}
      </p>
    </div>
  );
}
