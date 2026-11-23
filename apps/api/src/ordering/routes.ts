import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { sessionAccess } from '../auth/routes.ts';
import type { AppConfig } from '../config.ts';
import { HttpError, isDuplicateKey, parseInput } from '../http.ts';
import { Coupon, Order, type OrderRecord } from './models.ts';
import { checkoutSettings, priceCart } from './pricing.ts';
import { checkoutInput, orderReference, quoteInput, trackingInput } from './schemas.ts';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const oneDay = 24 * 60 * 60 * 1000;

export function orderView(order: OrderRecord) {
  const { reference, customer, fulfillment, notes, items, totals, coupon, orderStatus, paymentStatus, paymentMethod, createdAt } = order;
  return { reference, customer, fulfillment, notes, items, totals, coupon, orderStatus, paymentStatus, paymentMethod, createdAt };
}

export function orderingRouter(config: AppConfig) {
  const router = Router();
  const sessions = sessionAccess(config);
  const orderLimit = rateLimit({
    windowMs: 60000, limit: 25, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'TOO_MANY_REQUESTS', 'Try again later.')),
  });

  router.use(['/shop/checkout', '/orders'], (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/shop/checkout', async (_request, response) => {
    response.json(await checkoutSettings());
  });
  router.post('/orders/quote', orderLimit, async (request, response) => {
    const { items, totals } = await priceCart(parseInput(quoteInput, request.body));
    response.json({ items, totals, currency: 'LKR' });
  });

  router.post('/orders', orderLimit, async (request, response) => {
    const input = parseInput(checkoutInput, request.body);
    const user = await sessions.current(request);
    if (!user && !input.guestKey) throw new HttpError(400, 'GUEST_KEY_REQUIRED', 'A guest tracking key is required.');

    const preferred = input.fulfillment.preferredAt;
    if (preferred) {
      const time = new Date(preferred).getTime();
      const now = Date.now();
      if (time < now || time > now + 30 * oneDay) {
        throw new HttpError(400, 'INVALID_FULFILLMENT_TIME', 'Choose a time within the next 30 days.');
      }
    }

    const { guestKey, ...orderInput } = input;
    const guestHash = !user && guestKey ? hash(guestKey) : undefined;
    const fingerprint = hash(JSON.stringify([user?._id.toString(), guestHash, orderInput]));
    async function existingOrder() {
      const existing = await Order.findOne({ checkoutKey: input.checkoutKey }).lean();
      if (existing && existing.fingerprint !== fingerprint) {
        throw new HttpError(409, 'CHECKOUT_KEY_CONFLICT', 'Start a new checkout for a changed order.');
      }
      return existing;
    }

    const existing = await existingOrder();
    if (existing) {
      response.json({ order: orderView(existing) });
      return;
    }

    try {
      const reference = `Z-${randomBytes(10).toString('hex').toUpperCase()}`;
      const created = await mongoose.connection.transaction(async session => {
        const fulfillment = input.fulfillment.type === 'delivery' ? { type: 'delivery' as const, zoneId: input.fulfillment.zoneId } : { type: 'pickup' as const };
        const priced = await priceCart({ items: input.items, fulfillment, coupon: input.coupon }, session);
        if (input.expectedTotal !== priced.totals.total) {
          throw new HttpError(409, 'TOTAL_CHANGED', 'Review the updated order total.');
        }
        if (priced.couponRecord) {
          await Coupon.updateOne({ _id: priced.couponRecord._id }, { $inc: { uses: 1 } }, { session });
        }
        const order = new Order({
          reference,
          checkoutKey: input.checkoutKey,
          fingerprint,
          userId: user?._id,
          guestHash,
          customer: input.customer,
          fulfillment: input.fulfillment,
          notes: input.notes,
          items: priced.items,
          totals: priced.totals,
          coupon: input.coupon,
          paymentMethod: input.fulfillment.type === 'delivery' ? 'cash_delivery' : 'cash_pickup',
        });
        return order.save({ session });
      });
      response.status(201).json({ order: orderView(created) });
    } catch (error) {
      if (isDuplicateKey(error)) {
        const retry = await existingOrder();
        if (retry) {
          response.json({ order: orderView(retry) });
          return;
        }
      }
      throw error;
    }
  });

  router.post('/orders/track', orderLimit, async (request, response) => {
    const { reference, key } = parseInput(trackingInput, request.body);
    const order = await Order.findOne({ reference, guestHash: hash(key) }).lean();
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'No order matches those tracking details.');
    response.json({ order: orderView(order) });
  });

  router.get('/orders/mine', async (request, response) => {
    const user = await sessions.requireUser(request);
    const orders = await Order.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100).lean();
    response.json({ orders: orders.map(orderView) });
  });

  router.get('/orders/mine/:reference', async (request, response) => {
    const user = await sessions.requireUser(request);
    const reference = parseInput(orderReference, request.params.reference);
    const order = await Order.findOne({ reference, userId: user._id }).lean();
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'No order matches that reference.');
    response.json({ order: orderView(order) });
  });
  return router;
}
