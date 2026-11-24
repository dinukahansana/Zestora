import { Order } from '../ordering/models.ts';

export async function purchasedTogether(seeds: string[]) {
  if (!seeds.length) return new Map<string, number>();
  const recent = new Date(Date.now() - 90 * 86400000);
  const rows = await Order.aggregate<{ _id: string; baskets: number }>([
    { $match: {
      orderStatus: 'completed', paymentStatus: 'paid', paymentEnvironment: { $nin: ['sandbox', 'simulator'] },
      createdAt: { $gte: recent }, 'items.productSlug': { $in: seeds },
    } },
    { $project: { slugs: { $setUnion: ['$items.productSlug', []] } } },
    { $unwind: '$slugs' }, { $match: { slugs: { $nin: seeds } } },
    { $group: { _id: '$slugs', baskets: { $sum: 1 } } },
    { $match: { baskets: { $gte: 2 } } },
  ]);
  return new Map(rows.map(row => [row._id, row.baskets]));
}
