import { Citrus, Globe2, Menu, X } from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { contact } from '../content/contact';
import { languageOf } from '../i18n';

const links = [
  { path: '/', name: 'nav.home' },
  { path: '/menu', name: 'nav.menu' },
  { path: '/about', name: 'nav.about' },
  { path: '/gallery', name: 'nav.gallery' },
  { path: '/contact', name: 'nav.contact' },
];

const policies = [
  { path: '/faq', name: 'nav.faq' },
  { path: '/privacy', name: 'policy.privacy.title' },
  { path: '/terms', name: 'policy.terms.title' },
  { path: '/refunds', name: 'policy.refunds.title' },
  { path: '/cancellation', name: 'policy.cancellation.title' },
];

function Brand() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="inline-flex w-fit items-center gap-2.5" aria-label={t('common.brand')}>
      <span className="grid size-9 place-items-center rounded-full bg-lime text-ink min-[360px]:size-10">
        <Citrus size={23} aria-hidden="true" />
      </span>
      <span className="font-display text-2xl leading-none tracking-tight min-[360px]:text-3xl">Zestora<span className="text-[#648744]">.</span></span>
    </Link>
  );
}

function Header() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const language = languageOf(i18n.resolvedLanguage);

  function renderLinks() {
    return links.map(({ path, name }) => (
      <NavLink
        key={path}
        to={path}
        end={path === '/'}
        onClick={() => setOpen(false)}
        className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-bold transition-colors ${isActive ? 'bg-moss text-ink' : 'hover:bg-moss/65'}`}
      >
        {t(name)}
      </NavLink>
    ));
  }

  return (
    <header className="relative z-10 border-b border-line bg-cream" onKeyDown={event => {
      if (open && event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    }}>
      <div className="container-wide flex min-h-19 items-center justify-between gap-3">
        <Brand />
        <nav aria-label={t('nav.primary')} className="hidden gap-1 lg:flex">{renderLinks()}</nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-10 items-center rounded-full border border-line px-2.5 sm:px-3">
            <Globe2 size={15} aria-hidden="true" className="hidden shrink-0 min-[360px]:block" />
            <select
              aria-label={t('nav.language')}
              className="ml-1 min-w-0 cursor-pointer bg-transparent p-0.5 text-xs font-extrabold"
              value={language}
              onChange={event => void i18n.changeLanguage(event.target.value)}
            >
              <option value="en" lang="en">English</option>
              <option value="si" lang="si">සිංහල</option>
            </select>
          </div>
          <Link className="button button-primary hidden xl:inline-flex" to="/menu">{t('nav.order')}</Link>
          <button
            ref={menuButton}
            type="button"
            aria-label={t(open ? 'nav.close' : 'nav.open')}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            className="grid size-10 place-items-center rounded-full border border-line lg:hidden"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      <nav
        id="mobile-navigation"
        aria-label={t('nav.primary')}
        hidden={!open}
        className="border-t border-line px-5 py-4 lg:hidden"
      >
        <div className="flex flex-col gap-1">{renderLinks()}</div>
      </nav>
    </header>
  );
}

function Footer() {
  const { t, i18n } = useTranslation();
  const hours = contact.hours[languageOf(i18n.resolvedLanguage)] ?? contact.hours.en;
  return (
    <footer className="bg-forest pt-13 text-cream">
      <div className="container-wide grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <section>
          <Brand />
          <p className="mt-5 text-sm text-cream/80">{t('common.tagline')}</p>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-extrabold text-lime">{t('footer.explore')}</h2>
          <ul className="space-y-2 text-sm">{links.slice(1).map(link => <li key={link.path}><Link className="hover:underline" to={link.path}>{t(link.name)}</Link></li>)}</ul>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-extrabold text-lime">{t('footer.help')}</h2>
          <ul className="space-y-2 text-sm">{policies.map(link => <li key={link.path}><Link className="hover:underline" to={link.path}>{t(link.name)}</Link></li>)}</ul>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-extrabold text-lime">{t('footer.contact')}</h2>
          <div className="space-y-2 text-sm">
            {contact.address && <p>{contact.address}</p>}
            {hours && <p>{hours}</p>}
            {contact.email ? <a className="block break-words hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a> : <Link className="hover:underline" to="/contact">{t('home.contactAction')}</Link>}
          </div>
        </section>
      </div>
      <div className="container-wide mt-11 flex flex-wrap justify-between gap-2 border-t border-white/15 py-5 text-xs text-cream/75">
        <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
        <p>{t('footer.demo')}</p>
      </div>
    </footer>
  );
}

export function Layout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:rounded-lg focus:bg-paper focus:p-3">{t('nav.skip')}</a>
      <Header />
      <main id="main-content" ref={main} tabIndex={-1} className="min-h-[55vh] focus:outline-none">
        <Suspense fallback={<p className="container-wide py-10 text-muted" role="status">{t('common.loading')}</p>}><Outlet /></Suspense>
      </main>
      <Footer />
    </>
  );
}
