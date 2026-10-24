import type { TKey } from '../i18n';
import type { SurpriseContent } from '../types';
import { parseSongUrl, parseVideoUrl } from './media';

export const LIMITS = {
  name: 60,
  title: 120,
  message: 5000,
  dateLabel: 80,
  cardFront: 200,
  cardBack: 600,
  maxCards: 6,
  tlDate: 40,
  tlTitle: 100,
  tlText: 600,
  maxTimeline: 20,
  finalButton: 40,
  finalMessage: 2000,
  caption: 200,
  passwordMin: 4,
  passwordMax: 72,
} as const;

export type FieldErrors = Record<string, TKey>;

/** Steps: 0 basics, 1 message, 2 photos, 3 media, 4 extras, 5 theme/privacy, 6 review */
export const STEP_COUNT = 7;

export function validateStep(c: SurpriseContent, step: number): FieldErrors {
  const e: FieldErrors = {};
  if (step === 0) {
    if (!c.nameA.trim()) e.nameA = 'err.required';
    else if (c.nameA.length > LIMITS.name) e.nameA = 'err.tooLong';
    if (!c.nameB.trim()) e.nameB = 'err.required';
    else if (c.nameB.length > LIMITS.name) e.nameB = 'err.tooLong';
    if (!c.title.trim()) e.title = 'err.required';
    else if (c.title.length > LIMITS.title) e.title = 'err.tooLong';
  }
  if (step === 1) {
    if (!c.message.trim()) e.message = 'err.required';
    else if (c.message.length > LIMITS.message) e.message = 'err.tooLong';
  }
  if (step === 3) {
    if (c.songUrl.trim() && !parseSongUrl(c.songUrl)) e.songUrl = 'err.songUrl';
    if (c.videoUrl.trim() && !parseVideoUrl(c.videoUrl)) e.videoUrl = 'err.videoUrl';
  }
  if (step === 4) {
    if (c.specialDate && !isValidDate(c.specialDate)) e.specialDate = 'err.date';
    if (c.specialDateLabel.length > LIMITS.dateLabel) e.specialDateLabel = 'err.tooLong';
    c.cards.forEach((card, i) => {
      if (!card.front.trim() || !card.back.trim()) e[`card${i}`] = 'err.required';
      else if (card.front.length > LIMITS.cardFront || card.back.length > LIMITS.cardBack) {
        e[`card${i}`] = 'err.tooLong';
      }
    });
    c.timeline.forEach((item, i) => {
      if (!item.title.trim()) e[`tl${i}`] = 'err.required';
      else if (
        item.date.length > LIMITS.tlDate ||
        item.title.length > LIMITS.tlTitle ||
        item.text.length > LIMITS.tlText
      ) {
        e[`tl${i}`] = 'err.tooLong';
      }
    });
    const g = c.games;
    const nonEmpty = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
    if (g.coupons.enabled) {
      const n = nonEmpty(g.coupons.items).length;
      if (n < 1 || n > 8) e.couponItems = 'err.itemsCoupons';
      else if (g.coupons.items.some((x) => x.length > 120)) e.couponItems = 'err.tooLong';
    }
    if (g.wheel.enabled) {
      const n = nonEmpty(g.wheel.items).length;
      if (n < 2 || n > 8) e.wheelItems = 'err.itemsWheel';
      else if (g.wheel.items.some((x) => x.length > 60)) e.wheelItems = 'err.tooLong';
    }
    if (g.runaway.enabled) {
      if (!g.runaway.question.trim()) e.runawayQuestion = 'err.required';
      else if (g.runaway.question.length > 120) e.runawayQuestion = 'err.tooLong';
      if (g.runaway.yes.length > 40 || g.runaway.no.length > 40) e.runawayYes = 'err.tooLong';
      if (g.runaway.win.length > 200) e.runawayWin = 'err.tooLong';
    }
    if (c.finalButtonLabel.length > LIMITS.finalButton) e.finalButtonLabel = 'err.tooLong';
    if (c.finalMessage.length > LIMITS.finalMessage) e.finalMessage = 'err.tooLong';
    if (c.finalMessage.trim() && !c.finalButtonLabel.trim()) e.finalButtonLabel = 'err.required';
  }
  return e;
}

export function validatePublishable(c: SurpriseContent): { step: number; errors: FieldErrors } | null {
  for (const step of [0, 1, 3, 4]) {
    const errors = validateStep(c, step);
    if (Object.keys(errors).length) return { step, errors };
  }
  return null;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validatePassword(pw: string): TKey | null {
  if (pw.length < LIMITS.passwordMin) return 'err.passwordShort';
  if (pw.length > LIMITS.passwordMax) return 'err.tooLong';
  return null;
}

export function validateEmail(v: string): TKey | null {
  if (!v.trim()) return 'err.required';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'err.email';
}

/** Whole days between a YYYY-MM-DD date and today (negative = in the future). */
export function daysSince(date: string, now: Date = new Date()): number {
  const [y, m, d] = date.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - start) / 86_400_000);
}
