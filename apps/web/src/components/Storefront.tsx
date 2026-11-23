import { ArrowUpRight, Citrus, CupSoda, Leaf, Milk, Salad, Sparkles } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { categoriesBySlug, formatPrice, startingPrice, type Product } from '../content/catalogue';
import { languageOf } from '../i18n';

export const categoryIcons = new Map([
  ['juices', Citrus], ['smoothies', CupSoda], ['milkshakes', Milk],
  ['detox', Leaf], ['bowls', Salad], ['seasonal', Sparkles],
]);

export function DemoLabel({ withDescription = false }: { withDescription?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="rounded-full bg-moss px-3 py-1 text-xs font-extrabold text-ink">{t('common.demo')}</span>
      {withDescription && <p className="text-sm text-muted">{t('common.demoDetails')}</p>}
    </div>
  );
}

export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-b border-line bg-moss/50">
      <div className="container-wide py-11 sm:py-15">
        <h1 className="display-title">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-muted">{children}</div>}
      </div>
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { t, i18n } = useTranslation();
  const language = languageOf(i18n.resolvedLanguage);
  const name = product.name[language];
  const titleId = useId();
  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-paper">
      <Link className="block h-full rounded-2xl focus-visible:outline-offset-[-4px]" to={`/menu/${product.slug}`} aria-labelledby={titleId}>
        <div className="overflow-hidden">
          <img
            alt=""
            src={product.image}
            loading="lazy"
            width={760}
            height={760}
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
          />
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-extrabold text-muted">{categoriesBySlug.get(product.category)?.name[language]}</p>
          <h3 id={titleId} className="mt-1 font-display text-2xl group-hover:underline">{name}</h3>
          <p className="mt-1.5 min-h-10 text-sm leading-5 text-muted">{product.description[language]}</p>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3.5">
            <div>
              <p className="text-sm font-extrabold">{t('common.from', { price: formatPrice(startingPrice(product), language) })}</p>
              {!product.available && <p className="mt-1 text-xs font-bold text-[#8c3d2f]">{t('common.soldOut')}</p>}
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-moss group-hover:bg-lime" aria-hidden="true">
              <ArrowUpRight size={19} />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
