import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { ar } from '../../i18n/ar';
import { cleanGames, emptyContent, emptyGames, parseGames } from '../../types';
import { validateStep } from '../validation';

describe('translations', () => {
  it('Arabic has exactly the same keys and placeholders as English', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    const tokens = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(tokens(ar[key]), key).toBe(tokens(en[key]));
    }
  });
  it('shows the exact developer credit text', async () => {
    const { DEVELOPER_CREDIT } = await import('../../components/Layout');
    expect(DEVELOPER_CREDIT).toBe('Made by Hady Hesham');
  });
});

describe('games', () => {
  it('parses untrusted database JSON defensively', () => {
    expect(parseGames(null)).toEqual(emptyGames());
    const g = parseGames({ coupons: { enabled: true, items: ['a', 5, 'b'] }, wheel: { items: 'nope' } });
    expect(g.coupons).toEqual({ enabled: true, items: ['a', 'b'] });
    expect(g.wheel.items).toEqual([]);
  });
  it('cleans lists before saving', () => {
    const g = emptyGames();
    g.wheel = { enabled: true, items: [' a ', '', 'b', '  '] };
    expect(cleanGames(g).wheel.items).toEqual(['a', 'b']);
  });
  it('requires 2+ wheel slices and 1+ coupon when enabled', () => {
    const c = emptyContent();
    c.games.wheel = { enabled: true, items: ['only one'] };
    c.games.coupons = { enabled: true, items: [' '] };
    const e = validateStep(c, 4);
    expect(e.wheelItems).toBe('err.itemsWheel');
    expect(e.couponItems).toBe('err.itemsCoupons');
    c.games.wheel.items = ['a', 'b'];
    c.games.coupons.items = ['x'];
    expect(validateStep(c, 4)).toEqual({});
  });
});
