import { ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import { orderingEnabled } from '../commerce/api';
import { useCart } from '../commerce/cart';
import { DemoLabel, PageHeading, ProductCard } from '../components/Storefront';
import { formatPrice, startingPrice, type Product } from '../content/catalogue';
import { CatalogueMessage, useCatalogue } from '../content/useCatalogue';
import { languageOf } from '../i18n';

const sorts = ['recommended', 'low', 'high', 'az'] as const;
const normalize = (value: string) => value.normalize('NFC').toLowerCase().trim();

export function CataloguePage() {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const [params, setParams] = useSearchParams();
  const catalogue = useCatalogue();
  const categories = catalogue.data?.categories ?? [];
  const products = catalogue.data?.products ?? [];
  const availableCategory = (slug: string) => categories.some(item => item.slug === slug);
  const query = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'recommended';
  const search = normalize(query);

  function updateFilter(key: string, value: string, replace = false) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace, preventScrollReset: true });
  }

  const visible = products.filter(product => {
    if (availableCategory(category) && product.category !== category) return false;
    const fields = [product.name, product.description, ...product.ingredients];
    return !search || fields.some(field => Object.values(field).some(value => normalize(value).includes(search)));
  }).sort((left, right) => {
    if (sort === 'low') return startingPrice(left) - startingPrice(right);
    if (sort === 'high') return startingPrice(right) - startingPrice(left);
    if (sort === 'az') return left.name[language].localeCompare(right.name[language], language);
    return Number(right.featured) - Number(left.featured);
  });

  return (
    <>
      <PageHeading title={t('menu.title')}><p>{t('menu.description')}</p></PageHeading>
      <div className="container-wide py-8 sm:py-12">
        {!catalogue.data && <CatalogueMessage query={catalogue} />}
        {catalogue.data && <>
          {catalogue.data.demo && <DemoLabel withDescription />}
          <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-paper p-4 sm:grid-cols-[1.5fr_1fr_1fr]">
            <label className="grid gap-1.5 text-sm font-extrabold">
              {t('menu.search')}
              <span className="relative">
                <Search size={17} aria-hidden="true" className="absolute top-3 left-3.5 text-muted" />
                <input className="field pl-10" type="search" value={query} maxLength={100} placeholder={t('menu.placeholder')} onChange={event => updateFilter('q', event.target.value, true)} />
              </span>
            </label>
            <label className="grid gap-1.5 text-sm font-extrabold">
              {t('menu.category')}
              <select className="field" value={availableCategory(category) ? category : ''} onChange={event => updateFilter('category', event.target.value)}>
                <option value="">{t('menu.all')}</option>
                {categories.map(item => <option key={item.slug} value={item.slug}>{item.name[language]}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-extrabold">
              {t('menu.sort')}
              <select className="field" value={sorts.find(value => value === sort) ?? 'recommended'} onChange={event => updateFilter('sort', event.target.value === 'recommended' ? '' : event.target.value)}>
                {sorts.map(option => <option key={option} value={option}>{t(`menu.${option}`)}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-5 text-sm font-bold text-muted" aria-live="polite">{t('menu.count', { count: visible.length })}</p>
          {visible.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map(product => <ProductCard key={product.slug} product={product} />)}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-line bg-paper px-5 py-12 text-center">
              <p className="font-bold">{t('menu.none')}</p>
              <button className="button button-outline mt-4" type="button" onClick={() => setParams({})}>{t('menu.reset')}</button>
            </div>
          )}
        </>}
      </div>
    </>
  );
}

function ProductOptions({ product }: { product: Product }) {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const [sizeId, setSizeId] = useState(product.sizes[0].id);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<boolean>();
  const add = useCart(state => state.add);
  const size = product.sizes.find(option => option.id === sizeId) ?? product.sizes[0];
  const addOnPrice = product.addOns.reduce((total, option) => total + (addOns.includes(option.id) ? option.price : 0), 0);

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-display text-2xl">{t('product.options')}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-extrabold">
          <span id="product-size-label">{t('product.size')}</span>
          <select className="field" aria-labelledby="product-size-label" value={sizeId} onChange={event => setSizeId(event.target.value)}>
            {product.sizes.map(option => <option key={option.id} value={option.id}>{option.name[language]} · {formatPrice(option.price, language)}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-extrabold">
          <span id="product-quantity-label">{t('product.quantity')}</span>
          <select className="field" aria-labelledby="product-quantity-label" value={quantity} onChange={event => setQuantity(Number(event.target.value))}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-extrabold">{t('product.addOns')}</legend>
        {product.addOns.length ? (
          <div className="mt-2 grid gap-1.5">
            {product.addOns.map(option => (
              <label key={option.id} className="flex min-h-9 items-center gap-2.5 text-sm">
                <input type="checkbox" className="size-4 accent-forest" checked={addOns.includes(option.id)} onChange={event => {
                  const enabled = event.currentTarget.checked;
                  setAddOns(previous => enabled ? [...previous, option.id] : previous.filter(id => id !== option.id));
                }} />
                {option.name[language]} · +{formatPrice(option.price, language)}
              </label>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-muted">{t('product.noAddOns')}</p>}
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-1.5 border-t border-line pt-3" aria-live="polite">
        <span className="font-extrabold">{t('product.total')}</span>
        <strong className="text-xl">{formatPrice((size.price + addOnPrice) * quantity, language)}</strong>
      </div>
      {orderingEnabled && product.available ? <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button type="button" className="button button-primary" onClick={() => setAdded(add({ productSlug: product.slug, sizeId, addOnIds: addOns, quantity }))}>{t('commerce.add')}</button>
        {added && <Link to="/cart" className="button button-outline">{t('commerce.cart')}</Link>}
        {added !== undefined && <p className="w-full text-sm text-muted" role="status">{t(added ? 'commerce.added' : 'commerce.cartLimit')}</p>}
      </div> : <p className="mt-2 text-sm text-muted">{t('product.preview')}</p>}
    </section>
  );
}

export function ProductPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const catalogue = useCatalogue();
  const products = catalogue.data?.products ?? [];
  const product = products.find(item => item.slug === slug);
  const back = <Link to="/menu" className="inline-flex items-center gap-2 text-sm font-extrabold hover:underline"><ArrowLeft size={17} aria-hidden="true" /> {t('common.backMenu')}</Link>;

  if (!catalogue.data) {
    return <div className="container-wide py-8">{back}<div className="mt-5"><CatalogueMessage query={catalogue} /></div></div>;
  }

  if (!product) {
    return <><PageHeading title={t('product.missing')}><p>{t('product.missingText')}</p></PageHeading><div className="container-wide py-8">{back}</div></>;
  }

  const related = products.filter(item => item.slug !== product.slug).sort((left, right) => Number(right.category === product.category) - Number(left.category === product.category)).slice(0, 3);
  return (
    <div className="container-wide py-7 sm:py-11">
      {back}
      <div className="mt-5 grid items-start gap-7 lg:grid-cols-[1fr_1fr] lg:gap-12">
        <img src={product.image} alt={product.name[language]} width={760} height={760} className="aspect-square max-h-[40rem] w-full rounded-2xl object-cover" />
        <div>
          {catalogue.data.demo && product.demo !== false && <DemoLabel />}
          <p className="mt-3 text-sm font-extrabold text-muted">{catalogue.data.categories.find(item => item.slug === product.category)?.name[language]}</p>
          <h1 className="display-title mt-1">{product.name[language]}</h1>
          <p className="mt-3 leading-relaxed text-muted">{product.description[language]}</p>
          <p className={`mt-4 w-fit rounded-full px-3 py-1 text-sm font-extrabold ${product.available ? 'bg-moss text-ink' : 'bg-blush text-[#853c2d]'}`}>{t(product.available ? 'common.available' : 'common.soldOut')}</p>
          <h2 className="mt-5 text-sm font-extrabold">{t('product.ingredients')}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {product.ingredients.map(item => <li key={item.en} className="rounded-full border border-line bg-paper px-3 py-1 text-sm">{item[language]}</li>)}
          </ul>
          <ProductOptions key={product.slug} product={product} />
        </div>
      </div>
      <section className="mt-12 border-t border-line pt-8">
        <h2 className="display-title mb-5">{t('product.related')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map(item => <ProductCard key={item.slug} product={item} />)}</div>
      </section>
    </div>
  );
}
