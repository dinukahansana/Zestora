import { Stock } from '../admin/models.ts';
import type { StockUse } from '../ordering/inventory.ts';

export async function withStockAvailability<T extends { available: boolean; recipe?: StockUse[] }>(items: T[]) {
  const slugs = [...new Set(items.flatMap(item => (item.recipe ?? []).map(part => part.stockSlug)))];
  const stock = slugs.length ? await Stock.find({ slug: { $in: slugs } }).select('slug onHand').lean() : [];
  const amounts = new Map(stock.map(part => [part.slug, part.onHand]));
  return items.map(({ recipe, ...item }) => ({
    ...item,
    available: item.available && (recipe ?? []).every(part => (amounts.get(part.stockSlug) ?? 0) >= part.units),
  }));
}
