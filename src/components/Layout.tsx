import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { toErrorKey } from '../lib/errors';
import { isConfigured } from '../lib/supabase';
import { useToast } from './Toast';

export const DEVELOPER_CREDIT = 'Made by Hady Hesham';

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="LoveLink">
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff5c93" />
            <stop offset="1" stopColor="#9b5cff" />
          </linearGradient>
        </defs>
        <path
          d="M32 54S10 40 10 24c0-7 5-12 11-12 4.500 0 8.500 2.500 11 7 2.500-4.500 6.500-7 11-7 6 0 11 5 11 12 0 16-22 30-22 30z"
          fill="url(#lg)"
        />
      </svg>
      <span>LoveLink</span>
    </Link>
  );
}

export function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  const next = lang === 'ar' ? 'en' : 'ar';
  return (
    <button type="button" className="lang-switch" onClick={() => setLang(next)} aria-label={t('a11y.switchLang')} lang={next}>
      <span aria-hidden="true">🌐</span> {next === 'ar' ? 'العربية' : 'English'}
    </button>
  );
}

function Header() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const logout = async () => {
    try {
      await signOut();
      toast.push('info', t('auth.loggedOut'));
      nav('/');
    } catch (e) {
      toast.push('error', t(toErrorKey(e)));
    }
  };

  const links = (
    <>
      <NavLink to="/" end>{t('nav.home')}</NavLink>
      <NavLink to="/create">{t('nav.create')}</NavLink>
      {user && <NavLink to="/my">{t('nav.myPages')}</NavLink>}
      <NavLink to="/about">{t('nav.about')}</NavLink>
    </>
  );

  return (
    <header className="header">
      <div className="container header-in">
        <Logo />
        <nav className="nav-desktop" aria-label={t('a11y.mainNav')}>
          {links}
        </nav>
        <div className="header-actions">
          <LangSwitcher />
          {isConfigured &&
            (user ? (
              <button type="button" className="btn btn-ghost btn-sm nav-desktop" onClick={logout}>
                {t('nav.logout')}
              </button>
            ) : (
              <Link to="/login" className="btn btn-ghost btn-sm nav-desktop">
                {t('nav.login')}
              </Link>
            ))}
          <button
            type="button"
            className="burger"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t('a11y.closeMenu') : t('a11y.openMenu')}
            onClick={() => setOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" className="mobile-menu glass" aria-label={t('a11y.mainNav')}>
          {links}
          {isConfigured &&
            (user ? (
              <button type="button" className="link" onClick={logout}>
                {t('nav.logout')}
              </button>
            ) : (
              <NavLink to="/login">{t('nav.login')}</NavLink>
            ))}
          <Link to="/create" className="btn btn-primary btn-block">
            {t('home.cta')}
          </Link>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div className="container footer-in">
        <div>
          <Logo />
          <p className="muted">{t('foot.tagline')}</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/about">{t('foot.about')}</Link>
          <Link to="/privacy">{t('foot.privacy')}</Link>
          <Link to="/terms">{t('foot.terms')}</Link>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>{t('foot.rights', { year: new Date().getFullYear() })}</span>
        <span className="credit" dir="ltr" lang="en">
          {DEVELOPER_CREDIT}
        </span>
      </div>
    </footer>
  );
}

const HEARTS = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 12 + ((i * 7) % 18),
  delay: -((i * 3.700) % 22),
  dur: 16 + ((i * 5) % 14),
}));

export function FloatingHearts() {
  return (
    <div className="hearts" aria-hidden="true">
      {HEARTS.map((h, i) => (
        <span
          key={i}
          style={{ left: `${h.left}%`, fontSize: h.size, animationDelay: `${h.delay}s`, animationDuration: `${h.dur}s` }}
        >
          {i % 3 === 0 ? '💜' : i % 3 === 1 ? '💗' : '❤'}
        </span>
      ))}
    </div>
  );
}

export function Layout() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return (
    <div className="app">
      <a href="#main" className="skip">{t('a11y.skip')}</a>
      <FloatingHearts />
      <Header />
      <main id="main" className="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
