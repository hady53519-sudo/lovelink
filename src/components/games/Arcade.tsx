import type { TFn } from '../../i18n';
import type { GamesConfig } from '../../types';
import { CouponGame } from './CouponGame';
import { RunawayGame } from './RunawayGame';
import { WheelGame } from './WheelGame';

export function hasGames(g: GamesConfig): boolean {
  const filled = (xs: string[]) => xs.some((x) => x.trim());
  return (
    g.runaway.enabled ||
    (g.coupons.enabled && filled(g.coupons.items)) ||
    (g.wheel.enabled && g.wheel.items.filter((x) => x.trim()).length >= 2)
  );
}

export function Arcade({ games, tt }: { games: GamesConfig; tt: TFn }) {
  if (!hasGames(games)) return null;
  const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  return (
    <section className="sv-section sv-arcade reveal">
      <h3 className="sv-h">{tt('g.title')}</h3>
      <p className="sv-sub">{tt('g.sub')}</p>
      <div className="arcade-grid">
        {games.runaway.enabled && <RunawayGame cfg={games.runaway} tt={tt} />}
        {games.coupons.enabled && <CouponGame items={clean(games.coupons.items)} tt={tt} />}
        {games.wheel.enabled && <WheelGame items={clean(games.wheel.items)} tt={tt} />}
      </div>
    </section>
  );
}
