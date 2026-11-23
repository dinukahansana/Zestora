import { User } from '../auth/models.ts';
import { Order } from '../ordering/models.ts';
import { orderView } from '../ordering/routes.ts';
import { Stock } from './models.ts';

const timezone = 'Asia/Colombo';
const dayMs = 24 * 60 * 60 * 1000;
const recentStates = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'];

export async function revenueReport(period: 'day' | 'week' | 'month') {
  const start = new Date(Date.now() - dayMs * (period === 'day' ? 31 : 366));
  return Order.aggregate<{ period: string; revenue: number; paidOrders: number }>([
    { $match: { paymentStatus: 'paid', orderStatus: { $ne: 'cancelled' }, paidAt: { $gte: start } } },
    { $group: {
      _id: { $dateTrunc: { date: '$paidAt', unit: period, timezone, ...(period === 'week' ? { startOfWeek: 'monday' } : {}) } },
      revenue: { $sum: '$totals.total' }, paidOrders: { $sum: 1 },
    } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, period: { $dateToString: { date: '$_id', format: '%Y-%m-%d', timezone } }, revenue: 1, paidOrders: 1 } },
  ]);
}

export async function dashboard() {
  const [metrics, customers, recentOrders, popular, lowStock, sales] = await Promise.all([
    Order.aggregate<{ total: number; pending: number; completed: number; revenue: number }>([
      { $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $in: ['$orderStatus', recentStates] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$orderStatus', 'completed'] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $ne: ['$orderStatus', 'cancelled'] }] }, '$totals.total', 0] } },
      } },
      { $project: { _id: 0 } },
    ]),
    User.countDocuments({ role: 'customer' }),
    Order.find().sort({ createdAt: -1 }).limit(8).lean(),
    Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productSlug', name: { $first: '$items.name' }, units: { $sum: '$items.quantity' } } },
      { $sort: { units: -1, _id: 1 } }, { $limit: 8 },
    ]),
    Stock.find({ $expr: { $lte: ['$onHand', '$threshold'] } }).sort({ onHand: 1 }).limit(20).lean(),
    revenueReport('day'),
  ]);
  return { metrics: { ...(metrics[0] ?? { total: 0, pending: 0, completed: 0, revenue: 0 }), customers }, recentOrders: recentOrders.map(orderView), popular, lowStock, sales };
}
