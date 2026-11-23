import express, { Router, type Response } from 'express';
import mongoose, { type ClientSession, type Types } from 'mongoose';
import { z } from 'zod';
import { User } from '../auth/models.ts';
import { sessionAccess } from '../auth/routes.ts';
import { Category, Product } from '../catalogue/models.ts';
import { categoryInput, productInput, productValues, slugSchema } from '../catalogue/schemas.ts';
import type { AppConfig } from '../config.ts';
import { HttpError, parseInput } from '../http.ts';
import { Coupon, Order, orderStates, Shop, type OrderRecord, type OrderState } from '../ordering/models.ts';
import { orderView } from '../ordering/routes.ts';
import { codeSchema, orderReference } from '../ordering/schemas.ts';
import { validatedImage, type UploadImage } from './images.ts';
import { AuditLog, Stock } from './models.ts';
import { dashboard, revenueReport } from './reports.ts';
import { currentShop, nameSchema, shopInput } from './settings.ts';

const stockInput = z.strictObject({
  name: nameSchema, unit: z.string().trim().min(1).max(30),
  onHand: z.number().int().min(0).max(10000000), threshold: z.number().int().min(0).max(10000000),
});
const couponInput = z.strictObject({
  type: z.enum(['fixed', 'percent']), value: z.number().int().min(1).max(1000000), active: z.boolean(),
  minimumOrder: z.number().int().min(0).max(1000000), expiresAt: z.iso.datetime().optional(),
  usageLimit: z.number().int().min(1).max(1000000).optional(),
}).refine(coupon => coupon.type === 'fixed' || coupon.value <= 100, 'A percentage must be 1 to 100.');
const orderFilter = z.strictObject({
  status: z.enum(orderStates).optional(),
  q: z.string().trim().max(254).optional(),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
const periodInput = z.strictObject({ period: z.enum(['day', 'week', 'month']).default('day') });
const customerFilter = z.strictObject({ q: z.string().trim().toLowerCase().max(254).optional(), offset: z.coerce.number().int().min(0).max(10000).default(0) });
const customerId = z.string().regex(/^[a-f0-9]{24}$/i);

function regexLiteral(value: string) {
  return new RegExp(value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'), 'i');
}

function allowedTransition(order: OrderRecord, next: OrderState) {
  const current = order.orderStatus;
  if (next === 'cancelled') return !['completed', 'cancelled'].includes(current) && order.paymentStatus !== 'paid';
  if (current === 'pending') return next === 'confirmed';
  if (current === 'confirmed') return next === 'preparing';
  if (current === 'preparing') return next === (order.fulfillment.type === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery');
  return ['ready_for_pickup', 'out_for_delivery'].includes(current) && next === 'completed';
}

async function mutation<T>(response: Response, action: string, entity: string, reference: string, change: (session: ClientSession) => PromiseLike<T>) {
  const actorId = response.locals.actorId as Types.ObjectId;
  return mongoose.connection.transaction(async session => {
    const result = await change(session);
    await new AuditLog({ actorId, action, entity, reference }).save({ session });
    return result;
  });
}

function missing(entity: string): never {
  throw new HttpError(404, 'ADMIN_NOT_FOUND', `${entity} was not found.`);
}

export function adminRouter(config: AppConfig, uploadImage?: UploadImage) {
  const router = Router();
  const sessions = sessionAccess(config);
  router.use(async (request, response, next) => {
    const actor = await sessions.requireUser(request, 'admin');
    response.locals.actorId = actor._id;
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/dashboard', async (_request, response) => response.json(await dashboard()));
  router.get('/reports', async (request, response) => {
    const { period } = parseInput(periodInput, request.query);
    response.json({ period, items: await revenueReport(period) });
  });
  router.get('/audit', async (_request, response) => {
    response.json({ items: await AuditLog.find().sort({ createdAt: -1 }).limit(100).select('-__v').lean() });
  });

  router.get('/catalogue', async (_request, response) => {
    const [categories, products] = await Promise.all([
      Category.find().select('-__v').sort({ position: 1, slug: 1 }).lean(),
      Product.find().select('-__v').sort({ slug: 1 }).lean(),
    ]);
    response.json({ categories, products });
  });
  router.post('/categories', async (request, response) => {
    const data = parseInput(categoryInput, request.body);
    const item = await mutation(response, 'created', 'category', data.slug, session => new Category(data).save({ session }));
    response.status(201).json({ item });
  });
  router.put('/categories/:slug', async (request, response) => {
    const slug = parseInput(slugSchema, request.params.slug);
    const data = parseInput(categoryInput, request.body);
    if (data.slug !== slug) throw new HttpError(400, 'IMMUTABLE_SLUG', 'The category identifier cannot change.');
    const item = await mutation(response, 'updated', 'category', slug, async session =>
      await Category.findOneAndUpdate({ slug }, { $set: data }, { session, returnDocument: 'after' }).lean() ?? missing('Category'));
    response.json({ item });
  });
  router.delete('/categories/:slug', async (request, response) => {
    const slug = parseInput(slugSchema, request.params.slug);
    await mutation(response, 'archived', 'category', slug, async session => {
      if (!(await Category.updateOne({ slug }, { $set: { published: false } }, { session })).matchedCount) missing('Category');
    });
    response.status(204).end();
  });
  async function setProduct(session: ClientSession, data: z.infer<typeof productInput>, creating: boolean) {
    if (!(await Category.exists({ slug: data.category }).session(session))) missing('Category');
    const values = productValues(data);
    return creating
      ? new Product(values).save({ session })
      : await Product.findOneAndUpdate({ slug: data.slug }, { $set: values }, { session, returnDocument: 'after' }).lean() ?? missing('Product');
  }

  router.post('/products', async (request, response) => {
    const data = parseInput(productInput, request.body);
    const item = await mutation(response, 'created', 'product', data.slug, session => setProduct(session, data, true));
    response.status(201).json({ item });
  });
  router.put('/products/:slug', async (request, response) => {
    const slug = parseInput(slugSchema, request.params.slug);
    const data = parseInput(productInput, request.body);
    if (data.slug !== slug) throw new HttpError(400, 'IMMUTABLE_SLUG', 'The product identifier cannot change.');
    const item = await mutation(response, 'updated', 'product', slug, session => setProduct(session, data, false));
    response.json({ item });
  });
  router.delete('/products/:slug', async (request, response) => {
    const slug = parseInput(slugSchema, request.params.slug);
    await mutation(response, 'archived', 'product', slug, async session => {
      if (!(await Product.updateOne({ slug }, { $set: { published: false } }, { session })).matchedCount) missing('Product');
    });
    response.status(204).end();
  });

  router.get('/orders', async (request, response) => {
    const { q, status, offset } = parseInput(orderFilter, request.query);
    const filter = {
      ...(status && { orderStatus: status }),
      ...(q && { $or: [{ reference: regexLiteral(q) }, { 'customer.name': regexLiteral(q) }, { 'customer.email': regexLiteral(q) }] }),
    };
    const [orders, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip(offset).limit(50).lean(), Order.countDocuments(filter)]);
    response.json({ items: orders.map(orderView), total, offset });
  });
  router.get('/orders/:reference', async (request, response) => {
    const reference = parseInput(orderReference, request.params.reference);
    const order = await Order.findOne({ reference }).lean() ?? missing('Order');
    response.json({ order: orderView(order) });
  });
  router.patch('/orders/:reference/status', async (request, response) => {
    const reference = parseInput(orderReference, request.params.reference);
    const { status } = parseInput(z.strictObject({ status: z.enum(orderStates) }), request.body);
    const order = await mutation(response, 'status_changed', 'order', reference, async session => {
      const record = await Order.findOne({ reference }).session(session) ?? missing('Order');
      if (!allowedTransition(record, status)) throw new HttpError(409, 'INVALID_TRANSITION', 'This order status change is unavailable.');
      record.orderStatus = status;
      return record.save({ session });
    });
    response.json({ order: orderView(order) });
  });
  router.patch('/orders/:reference/cash-payment', async (request, response) => {
    const reference = parseInput(orderReference, request.params.reference);
    const order = await mutation(response, 'cash_paid', 'order', reference, async session => {
      const record = await Order.findOne({ reference }).session(session) ?? missing('Order');
      if (record.paymentStatus !== 'pending' || record.paymentMethod === 'payhere' || record.orderStatus === 'cancelled') {
        throw new HttpError(409, 'PAYMENT_UNAVAILABLE', 'This cash payment cannot be confirmed.');
      }
      record.paymentStatus = 'paid';
      record.paidAt = new Date();
      return record.save({ session });
    });
    response.json({ order: orderView(order) });
  });

  router.get('/customers', async (request, response) => {
    const { q, offset } = parseInput(customerFilter, request.query);
    const filter = { role: 'customer' as const, ...(q && { $or: [{ email: regexLiteral(q) }, { name: regexLiteral(q) }] }) };
    const [items, total] = await Promise.all([
      User.find(filter).select('name email createdAt').sort({ createdAt: -1 }).skip(offset).limit(50).lean(), User.countDocuments(filter),
    ]);
    response.json({ items, total, offset });
  });
  router.get('/customers/:id/orders', async (request, response) => {
    const id = parseInput(customerId, request.params.id);
    if (!(await User.exists({ _id: id, role: 'customer' }))) missing('Customer');
    const orders = await Order.find({ userId: id }).sort({ createdAt: -1 }).limit(100).lean();
    response.json({ items: orders.map(orderView) });
  });

  router.get('/coupons', async (_request, response) => response.json({ items: await Coupon.find().sort({ code: 1 }).lean() }));
  router.put('/coupons/:code', async (request, response) => {
    const code = parseInput(codeSchema, request.params.code);
    const { expiresAt, usageLimit, ...data } = parseInput(couponInput, request.body);
    const $set = { ...data, ...(expiresAt && { expiresAt: new Date(expiresAt) }), ...(usageLimit !== undefined && { usageLimit }) };
    const $unset = { ...(expiresAt ? {} : { expiresAt: 1 }), ...(usageLimit === undefined && { usageLimit: 1 }) };
    const item = await mutation(response, 'saved', 'coupon', code, session => Coupon.findOneAndUpdate(
      { code }, { $set, $unset, $setOnInsert: { uses: 0 } }, { session, upsert: true, returnDocument: 'after' },
    ).lean());
    response.json({ item });
  });
  router.get('/inventory', async (_request, response) => response.json({ items: await Stock.find().sort({ slug: 1 }).lean() }));
  router.put('/inventory/:slug', async (request, response) => {
    const slug = parseInput(slugSchema, request.params.slug);
    const values = parseInput(stockInput, request.body);
    const item = await mutation(response, 'saved', 'stock', slug, session => Stock.findOneAndUpdate(
      { slug }, { $set: values }, { session, upsert: true, returnDocument: 'after' },
    ).lean());
    response.json({ item });
  });

  router.get('/settings', async (_request, response) => response.json(await currentShop()));
  router.put('/settings', async (request, response) => {
    const values = parseInput(shopInput, request.body);
    await mutation(response, 'saved', 'settings', 'default', session => Shop.updateOne({ key: 'default' }, { $set: values }, { session, upsert: true }));
    response.json(await currentShop());
  });

  router.post('/images', express.raw({ limit: '6mb', type: ['image/jpeg', 'image/png', 'image/webp'] }), async (request, response) => {
    if (!uploadImage) throw new HttpError(503, 'IMAGES_UNAVAILABLE', 'Cloudinary image storage is not configured.');
    const image = await validatedImage(request.body);
    const url = await uploadImage(image);
    await AuditLog.create({ actorId: response.locals.actorId, action: 'uploaded', entity: 'image', reference: url });
    response.status(201).json({ url });
  });

  return router;
}
