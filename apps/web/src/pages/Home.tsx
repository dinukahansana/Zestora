import { ArrowDownRight, ArrowRight, Check, Leaf, Sparkles } from 'lucide-react';
import { domAnimation, LazyMotion, m, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { categoryIcons, DemoLabel, ProductCard } from '../components/Storefront';
import { categories, products } from '../content/catalogue';
import { languageOf } from '../i18n';

const categoryStyles = ['bg-sun/45', 'bg-blush', 'bg-moss', 'bg-lime/65', 'bg-sun/35', 'bg-blush'];
const featureKeys = ['home.fruit', 'home.choices', 'home.local'];
const popular = products.filter(product => ['golden-mango', 'cocoa-cloud', 'island-fruit-bowl'].includes(product.slug));

export function HomePage() {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const reducedMotion = useReducedMotion();

  return (
    <>
      <section className="container-wide pt-5 sm:pt-8">
        <div className="grid overflow-hidden rounded-[1.75rem] bg-forest text-cream sm:rounded-[2rem] lg:grid-cols-[.98fr_1fr]">
          <LazyMotion features={domAnimation} strict>
            <m.div
              initial={reducedMotion ? false : { y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="relative flex flex-col justify-center px-6 py-11 sm:px-11 sm:py-15"
            >
              <h1 className="font-display text-[clamp(2.7rem,5.6vw,5.35rem)] leading-[1.06] tracking-tight">
                <span className="block">{t('home.heroFirst')}</span>
                <span className="block text-lime">{t('home.heroLast')}</span>
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-cream/85 sm:text-base">{t('home.heroDescription')}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link className="button button-light" to="/menu">{t('nav.order')} <ArrowRight size={17} aria-hidden="true" /></Link>
                <Link className="button button-outline" to="/about">{t('home.storyLink')}</Link>
              </div>
              <Leaf className="absolute right-6 bottom-6 hidden text-lime/25 2xl:block" size={44} strokeWidth={1} aria-hidden="true" />
            </m.div>
          </LazyMotion>
          <div className="store-hero-photo relative overflow-hidden">
            <img src="/images/hero.webp" alt={t('home.heroAlt')} fetchPriority="high" className="absolute inset-0 size-full object-cover object-center" />
          </div>
        </div>
      </section>

      <section className="container-wide py-10 sm:py-13" aria-labelledby="categories-heading">
        <div className="mb-5 flex items-center gap-2">
          <h2 id="categories-heading" className="font-display text-3xl">{t('home.categories')}</h2>
          <ArrowDownRight aria-hidden="true" className="text-muted" size={22} />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category, index) => {
            const Icon = categoryIcons.get(category.slug) ?? Sparkles;
            return (
              <Link key={category.slug} to={`/menu?category=${category.slug}`} className="group flex min-h-16 items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-bold hover:border-[#829b78]">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${categoryStyles[index]}`}><Icon size={19} aria-hidden="true" /></span>
                {category.name[language]}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-y border-line bg-moss/30">
        <div className="container-wide section-space">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <DemoLabel />
              <h2 className="display-title mt-3">{t('home.featured')}</h2>
              <p className="mt-2 text-muted">{t('home.featuredText')}</p>
            </div>
            <Link className="button button-outline" to="/menu">{t('home.viewAll')} <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.filter(product => product.featured).map(product => <ProductCard key={product.slug} product={product} />)}
          </div>
        </div>
      </section>

      <section className="container-wide section-space">
        <div className="grid items-center gap-7 lg:grid-cols-2 lg:gap-15">
          <img src="/images/counter.webp" alt={t('about.counterAlt')} loading="lazy" className="aspect-[5/3] w-full rounded-2xl object-cover" />
          <div>
            <h2 className="display-title">{t('home.story')}</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-muted">{t('home.storyText')}</p>
            <ul className="mt-5 grid gap-3 font-bold">
              {featureKeys.map(key => <li key={key} className="flex items-center gap-2"><Check size={18} aria-hidden="true" /> {t(key)}</li>)}
            </ul>
            <Link className="button button-outline mt-6" to="/about">{t('home.storyLink')}</Link>
          </div>
        </div>
      </section>

      <section className="container-wide">
        <div className="grid items-stretch overflow-hidden rounded-2xl bg-[#f6d59d] md:grid-cols-[1.12fr_1fr]">
          <div className="self-center px-6 py-9 sm:px-10">
            <h2 className="display-title">{t('home.seasonal')}</h2>
            <p className="mt-3 max-w-lg text-ink/85">{t('home.seasonalText')}</p>
            <Link className="button button-primary mt-5" to="/menu/passion-cooler">{t('home.seasonalAction')} <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          <img src="/images/passion.webp" alt="" loading="lazy" className="h-63 w-full object-cover object-center md:h-80" />
        </div>
      </section>

      <section className="container-wide section-space">
        <h2 className="display-title">{t('home.popular')}</h2>
        <p className="mt-2 text-muted">{t('home.popularText')}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {popular.map(product => (
            <Link to={`/menu/${product.slug}`} key={product.slug} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-2.5 font-extrabold hover:bg-moss/40">
              <img src={product.image} alt="" loading="lazy" width={58} height={58} className="size-14 rounded-lg object-cover" />
              {product.name[language]}
              <ArrowRight className="ml-auto shrink-0" size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-blush/50">
        <div className="container-wide section-space">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="display-title">{t('home.gallery')}</h2>
            <Link className="button button-outline" to="/gallery">{t('home.galleryAction')}</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
            <img src="/images/counter.webp" alt={t('about.counterAlt')} loading="lazy" className="col-span-2 h-48 w-full rounded-xl object-cover md:col-span-1 md:h-55" />
            {products.slice(1, 3).map(product => <img key={product.slug} src={product.image} alt={product.name[language]} loading="lazy" className="h-36 w-full rounded-xl object-cover sm:h-55" />)}
          </div>
        </div>
      </section>

      <section className="container-wide section-space">
        <p className="text-sm font-extrabold text-muted">{t('home.testimonialLabel')}</p>
        <h2 className="display-title mt-2">{t('home.testimonials')}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {['home.quoteOne', 'home.quoteTwo'].map(key => <blockquote key={key} className="rounded-2xl border border-line bg-paper p-5 font-display text-2xl leading-snug sm:p-7">“{t(key)}”</blockquote>)}
        </div>
      </section>

      <section className="border-t border-line bg-moss/50">
        <div className="container-wide flex flex-wrap items-center justify-between gap-4 py-8">
          <h2 className="font-display text-3xl">{t('home.questions')}</h2>
          <Link className="button button-primary" to="/contact">{t('home.contactAction')} <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
