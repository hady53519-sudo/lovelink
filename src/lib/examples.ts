import { makeT } from '../i18n';
import { placeholderPhoto } from './format';
import { emptyGames, type Lang, type SurpriseContent, type Theme, type ViewPhoto } from '../types';

/** Demo pages for the homepage. All text is written here, so no backend is needed. */
export function exampleContent(theme: Theme, lang: Lang): SurpriseContent {
  const tt = makeT(lang);
  const ar = lang === 'ar';
  const games = emptyGames();
  games.runaway = { enabled: true, question: '', yes: '', no: '', win: '' };
  games.coupons = { enabled: true, items: tt('g.defCoupons').split('\n') };
  games.wheel = { enabled: true, items: tt('g.defWheel').split('\n') };

  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return {
    lang,
    theme,
    nameA: ar ? 'هادي' : 'Hady',
    nameB: ar ? 'سارة' : 'Sara',
    title: ar ? 'كل عام وأنتِ حبيبتي' : 'Happy Anniversary, my love',
    message: ar
      ? 'يا سارة،\n\nمنذ اليوم الذي التقينا فيه صار كل شيء أجمل. أضحك أكثر، وأحلم أكثر، وأنتظر الغد لأنك فيه.\n\nشكرًا لأنك أنتِ.'
      : 'Dear Sara,\n\nSince the day we met, everything got a little brighter. I laugh more, dream more, and look forward to tomorrow because you are in it.\n\nThank you for being you.',
    songUrl: '',
    videoUrl: '',
    specialDate: d.toISOString().slice(0, 10),
    specialDateLabel: ar ? 'ذكرى ارتباطنا' : 'Our anniversary',
    cards: [
      {
        front: ar ? 'اضغط عليّ 💌' : 'Tap me 💌',
        back: ar ? 'أحبك أكثر مما تتخيلين.' : 'I love you more than you think.',
      },
      {
        front: ar ? 'سر صغير 🤫' : 'A little secret 🤫',
        back: ar ? 'أنتِ أحسن قرار اتخذته.' : 'You are the best decision I ever made.',
      },
    ],
    timeline: [
      { date: ar ? 'الصيف الأول' : 'First summer', title: ar ? 'التقينا' : 'We met', text: ar ? 'ولم أكن أعلم أن حياتي ستتغير.' : 'I had no idea my life was about to change.' },
      { date: ar ? 'الخريف' : 'Autumn', title: ar ? 'أول موعد' : 'Our first date', text: ar ? 'وأطول عشاء في التاريخ.' : 'And the longest dinner in history.' },
      { date: ar ? 'اليوم' : 'Today', title: ar ? 'ما زلنا معًا' : 'Still together', text: ar ? 'والقادم أجمل.' : 'And the best is yet to come.' },
    ],
    games,
    finalButtonLabel: ar ? 'شيء أخير…' : 'One last thing…',
    finalMessage: ar ? 'هل تتزوجينني؟ 💍' : 'Will you marry me? 💍',
  };
}

export function examplePhotos(lang: Lang): ViewPhoto[] {
  const caps = lang === 'ar' ? ['رحلتنا', 'قهوة الصباح', 'أجمل يوم'] : ['Our trip', 'Morning coffee', 'Best day ever'];
  return caps.map((caption, i) => ({ url: placeholderPhoto(i), caption }));
}
