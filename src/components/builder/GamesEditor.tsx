import { useMemo } from 'react';
import { makeT, useI18n, type TKey } from '../../i18n';
import type { FieldErrors } from '../../lib/validation';
import type { GamesConfig, Lang } from '../../types';
import { TextArea, TextField, Toggle } from '../Field';

interface Props {
  games: GamesConfig;
  lang: Lang;
  errors: FieldErrors;
  onChange: (g: GamesConfig) => void;
}

const lines = (s: string) => s.split('\n');

export function GamesEditor({ games, lang, errors, onChange }: Props) {
  const { t } = useI18n();
  // Example text is written in the language of the *page*, not the site UI.
  const pageT = useMemo(() => makeT(lang), [lang]);
  const err = (k: string): TKey | undefined => errors[k];

  const setRunaway = (patch: Partial<GamesConfig['runaway']>) =>
    onChange({ ...games, runaway: { ...games.runaway, ...patch } });

  const setList = (key: 'coupons' | 'wheel', patch: Partial<GamesConfig['coupons']>) =>
    onChange({ ...games, [key]: { ...games[key], ...patch } });

  const toggleList = (key: 'coupons' | 'wheel', on: boolean) => {
    const defaults = lines(pageT(key === 'coupons' ? 'g.defCoupons' : 'g.defWheel'));
    const items = on && games[key].items.every((x) => !x.trim()) ? defaults : games[key].items;
    setList(key, { enabled: on, items });
  };

  return (
    <fieldset className="group">
      <legend>{t('f.games')}</legend>
      <p className="hint">{t('f.gamesHint')}</p>

      <div className="game-edit glass">
        <Toggle
          checked={games.runaway.enabled}
          onChange={(v) => setRunaway({ enabled: v })}
          label={`🏃 ${t('g.runaway')}`}
          desc={t('g.runawayDesc')}
        />
        {games.runaway.enabled && (
          <div className="game-fields">
            <TextField
              label={t('g.question')}
              value={games.runaway.question}
              onChange={(v) => setRunaway({ question: v })}
              placeholder={pageT('g.defQuestion')}
              maxLength={120}
              error={err('runawayQuestion')}
            />
            <div className="grid-2">
              <TextField
                label={t('g.yes')}
                value={games.runaway.yes}
                onChange={(v) => setRunaway({ yes: v })}
                placeholder={pageT('g.defYes')}
                maxLength={40}
                error={err('runawayYes')}
              />
              <TextField
                label={t('g.no')}
                value={games.runaway.no}
                onChange={(v) => setRunaway({ no: v })}
                placeholder={pageT('g.defNo')}
                maxLength={40}
              />
            </div>
            <TextField
              label={t('g.win')}
              value={games.runaway.win}
              onChange={(v) => setRunaway({ win: v })}
              placeholder={pageT('g.defWin')}
              maxLength={200}
              error={err('runawayWin')}
            />
          </div>
        )}
      </div>

      <div className="game-edit glass">
        <Toggle
          checked={games.coupons.enabled}
          onChange={(v) => toggleList('coupons', v)}
          label={`🎟️ ${t('g.coupons')}`}
          desc={t('g.couponsDesc')}
        />
        {games.coupons.enabled && (
          <div className="game-fields">
            <TextArea
              label={t('g.couponItems')}
              rows={6}
              value={games.coupons.items.join('\n')}
              onChange={(v) => setList('coupons', { items: lines(v) })}
              error={err('couponItems')}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setList('coupons', { items: lines(pageT('g.defCoupons')) })}
            >
              ✨ {t('g.defaults')}
            </button>
          </div>
        )}
      </div>

      <div className="game-edit glass">
        <Toggle
          checked={games.wheel.enabled}
          onChange={(v) => toggleList('wheel', v)}
          label={`🎡 ${t('g.wheel')}`}
          desc={t('g.wheelDesc')}
        />
        {games.wheel.enabled && (
          <div className="game-fields">
            <TextArea
              label={t('g.wheelItems')}
              rows={6}
              value={games.wheel.items.join('\n')}
              onChange={(v) => setList('wheel', { items: lines(v) })}
              error={err('wheelItems')}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setList('wheel', { items: lines(pageT('g.defWheel')) })}
            >
              ✨ {t('g.defaults')}
            </button>
          </div>
        )}
      </div>
    </fieldset>
  );
}
