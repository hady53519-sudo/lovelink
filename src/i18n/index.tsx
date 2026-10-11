import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type TKey } from './en';
import { ar } from './ar';
import type { Lang } from '../types';

export type { TKey };
export type Vars = Record<string, string | number>;
export type TFn = (key: TKey, vars?: Vars) => string;

const dictionaries: Record<Lang, Record<TKey, string>> = { en, ar };

/** Pure translator, usable for any language (e.g. a surprise page in its own language). */
export function makeT(lang: Lang): TFn {
  return (key, vars) => {
    let s = dictionaries[lang][key] ?? en[key];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    }
    return s;
  };
}

const STORAGE_KEY = 'lovelink.lang';

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'ar' || v === 'en') return v;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

interface I18nValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: TFn;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const value = useMemo<I18nValue>(() => ({ lang, dir, setLang, t: makeT(lang) }), [lang, dir, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
