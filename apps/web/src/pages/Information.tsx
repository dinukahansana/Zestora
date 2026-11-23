import { ChevronDown, X, ZoomIn } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeading } from '../components/Storefront';
import { products } from '../content/catalogue';
import { languageOf } from '../i18n';

export function AboutPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeading title={t('about.title')}><p>{t('about.intro')}</p></PageHeading>
      <div className="container-wide section-space grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <img className="aspect-[5/4] w-full rounded-2xl object-cover" src="/images/counter.webp" alt={t('about.counterAlt')} />
        <div>
          <h2 className="display-title">{t('about.story')}</h2>
          <p className="mt-4 leading-relaxed text-muted">{t('about.text')}</p>
          <h3 className="mt-6 font-display text-2xl">{t('about.values')}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            {['home.fruit', 'home.choices', 'home.local'].map(key => <li key={key}>{t(key)}</li>)}
          </ul>
          <Link className="button button-primary mt-6" to="/menu">{t('nav.order')}</Link>
        </div>
      </div>
    </>
  );
}

export function GalleryPage() {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const photos = [{ src: '/images/counter.webp', alt: t('about.counterAlt') }, ...products.map(product => ({ src: product.image, alt: product.name[language] }))];
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const photo = selected === null ? null : photos[selected];

  useEffect(() => {
    if (selected !== null && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);

  return (
    <>
      <PageHeading title={t('gallery.title')}><p>{t('gallery.intro')}</p></PageHeading>
      <div className="container-wide section-space grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((item, index) => (
          <button className="group relative overflow-hidden rounded-2xl bg-moss text-left" key={item.src} type="button" aria-label={t('gallery.open', { name: item.alt })} onClick={() => setSelected(index)}>
            <img src={item.src} alt="" className="aspect-[4/3] w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.04]" loading="lazy" />
            <span className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-paper text-ink"><ZoomIn size={19} aria-hidden="true" /></span>
          </button>
        ))}
      </div>
      <dialog ref={dialog} aria-label={photo?.alt} className="m-auto max-h-[90vh] w-[min(90vw,52rem)] overflow-auto rounded-2xl bg-paper text-ink backdrop:bg-black/65" onClose={() => setSelected(null)}>
        {photo && <>
          <img src={photo.src} alt={photo.alt} className="max-h-[75vh] w-full bg-moss object-contain" />
          <div className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm font-bold">{photo.alt}</p>
            <button type="button" className="grid size-10 shrink-0 place-items-center rounded-full bg-moss" aria-label={t('gallery.close')} onClick={() => dialog.current?.close()}><X size={20} /></button>
          </div>
        </>}
      </dialog>
    </>
  );
}

export function FaqPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeading title={t('faq.title')}><p>{t('faq.intro')}</p></PageHeading>
      <div className="container-wide section-space">
        <div className="max-w-3xl space-y-3">
          {['one', 'two', 'three', 'four'].map(item => (
            <details className="group rounded-xl border border-line bg-paper p-4 sm:p-5" key={item}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-extrabold">
                {t(`faq.${item}Q`)}
                <ChevronDown size={18} className="shrink-0 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{t(`faq.${item}A`)}</p>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}

export function PolicyPage({ policy }: { policy: 'privacy' | 'terms' | 'refunds' | 'cancellation' }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeading title={t(`policy.${policy}.title`)}><p className="font-bold">{t('policy.demo')}</p></PageHeading>
      <div className="container-wide section-space">
        <p className="max-w-2xl leading-relaxed">{t(`policy.${policy}.text`)}</p>
        <p className="mt-4 max-w-2xl rounded-xl bg-moss px-4 py-3 leading-relaxed text-muted">{t('policy.notice')}</p>
      </div>
    </>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeading title={t('notFound.title')}><p>{t('notFound.text')}</p></PageHeading>
      <div className="container-wide py-8"><Link className="button button-primary" to="/">{t('common.backHome')}</Link></div>
    </>
  );
}
