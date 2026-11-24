import { StockMovement } from '../admin/models.ts';
import { Order } from '../ordering/models.ts';

const lookbackDays = 30;
const minimumOrders = 15;
const minimumDays = 7;

export async function demandByIngredient(now = new Date()) {
  const since = new Date(now.getTime() - lookbackDays * 86400000);
  const totals = await StockMovement.aggregate<{ _id: string; units: number; orders: number; days: string[] }>([
    { $match: { releasedAt: { $exists: false }, createdAt: { $gte: since, $lt: now } } },
    { $lookup: { from: Order.collection.name, localField: 'orderReference', foreignField: 'reference', as: 'order' } },
    { $unwind: '$order' },
    { $match: { 'order.orderStatus': 'completed', 'order.paymentStatus': 'paid', 'order.paymentEnvironment': { $nin: ['sandbox', 'simulator'] } } },
    { $unwind: '$usage' },
    { $group: {
      _id: '$usage.stockSlug', units: { $sum: '$usage.units' }, orders: { $sum: 1 },
      days: { $addToSet: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: 'Asia/Colombo' } } },
    } },
  ]);
  return new Map(totals.map(item => [item._id, {
    orders: item.orders, days: item.days.length,
    nextWeekUnits: item.orders >= minimumOrders && item.days.length >= minimumDays ? Math.ceil(item.units * 7 / lookbackDays) : null,
  }]));
}
