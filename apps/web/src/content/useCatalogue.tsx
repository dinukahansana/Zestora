import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { categories, products, type Category, type Product } from './catalogue';

const localText = z.object({ en: z.string(), si: z.string() });
const choice = z.object({ id: z.string(), name: localText, price: z.number().int().nonnegative() });

const schema = z.object({
  categories: z.array(z.object({ slug: z.string(), name: localText })),
  products: z.array(z.object({
    slug: z.string(),
    category: z.string(),
    name: localText,
    description: localText,
    ingredients: z.array(localText),
    image: z.string(),
    featured: z.boolean(),
    available: z.boolean(),
    demo: z.boolean().optional(),
    sizes: z.array(choice).min(1),
    addOns: z.array(choice),
  })),
});

type Catalogue = { categories: Category[]; products: Product[]; demo: boolean };
const demoCatalogue: Catalogue = { categories, products, demo: true };
const useApi = import.meta.env.VITE_CATALOGUE_MODE === 'api';

async function fetchCatalogue(signal: AbortSignal): Promise<Catalogue> {
  const response = await fetch('/api/catalogue', { signal });
  if (!response.ok) throw new Error('Could not load the catalogue.');
  const data = schema.parse(await response.json());
  return { ...data, demo: data.products.some(product => product.demo) };
}

export function useCatalogue() {
  return useQuery({
    queryKey: ['catalogue', useApi ? 'api' : 'demo'],
    queryFn: ({ signal }) => fetchCatalogue(signal),
    enabled: useApi,
    initialData: useApi ? undefined : demoCatalogue,
    staleTime: 60 * 1000,
  });
}

export function CatalogueMessage({ query }: { query: ReturnType<typeof useCatalogue> }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-line bg-paper p-5" role={query.isError ? 'alert' : 'status'}>
      <p>{t(query.isError ? 'menu.loadError' : 'common.loading')}</p>
      {query.isError && <button className="button button-outline mt-3" type="button" onClick={() => void query.refetch()}>{t('common.retry')}</button>}
    </div>
  );
}
