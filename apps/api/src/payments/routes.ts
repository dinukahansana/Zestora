import { createHash } from 'node:crypto';
import express, { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { automationConfigured } from '../automation/delivery.ts';
import { recordEvent } from '../automation/events.ts';
import { sessionAccess } from '../auth/routes.ts';
import type { AppConfig } from '../config.ts';
import { HttpError, parseInput } from '../http.ts';
import type { SendEmail } from '../mail.ts';
import { deliverNotice, prepareNotice } from '../notifications.ts';
import { Order, type PaymentState } from '../ordering/models.ts';
import { guestKeySchema, orderReference } from '../ordering/schemas.ts';
import { Payment, type PaymentEnvironment } from './models.ts';
import { callbackInput, checkoutHash, paymentMode, verifyCallback } from './payhere.ts';

const access = z.strictObject({ reference: orderReference, key: guestKeySchema.optional() });
const simulation = access.extend({ outcome: z.enum(['paid', 'failed']) });

export function paymentsRouter(config: AppConfig, sendEmail?: SendEmail) {
  const router = Router();
  const sessions = sessionAccess(config);
  const mode = paymentMode(config);
  const limits = rateLimit({
    windowMs: 60000, limit: 35, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'TOO_MANY_REQUESTS', 'Try again later.')),
  });

  async function accessibleOrder(request: Request, { reference, key }: z.infer<typeof access>) {
    const customer = await sessions.current(request);
    const owners = [
      ...(customer ? [{ userId: customer._id }] : []),
      ...(key ? [{ guestHash: createHash('sha256').update(key).digest('hex') }] : []),
    ];
    if (!owners.length) throw new HttpError(401, 'SIGN_IN_REQUIRED', 'Sign in or provide the guest order key.');
    const order = await Order.findOne({ reference, $or: owners }).lean();
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'The order was not found.');
    return order;
  }

  async function changePayment(reference: string, environment: PaymentEnvironment, amount: number, status: PaymentState, providerId: string, code: string) {
    const result = await mongoose.connection.transaction(async session => {
      const order = await Order.findOne({ reference, paymentMethod: 'payhere', paymentEnvironment: environment }).session(session);
      const payment = await Payment.findOne({ orderReference: reference, environment }).session(session);
      if (!order || !payment) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'The payment was not found.');
      if (order.totals.total !== amount || payment.amount !== amount || payment.currency !== 'LKR') {
        throw new HttpError(409, 'PAYMENT_MISMATCH', 'The payment amount does not match the order.');
      }
      const current = payment.status;
      const allowed = current === 'pending' ? status === 'paid' || status === 'failed'
        : current === 'failed' ? status === 'paid'
        : current === 'paid' ? status === 'refunded' && payment.providerId === providerId
        : false;
      if (!allowed) return { status: current, key: undefined };
      payment.status = status;
      payment.providerId = providerId;
      payment.lastStatus = code;
      order.paymentStatus = status;
      if (status === 'paid') {
        payment.paidAt = new Date();
        order.paidAt = payment.paidAt;
      }
      await payment.save({ session });
      await order.save({ session });
      const key = environment === 'live' && status !== 'pending' ? await prepareNotice(order, status, session, sendEmail) : undefined;
      await recordEvent(status === 'paid' ? 'payment.completed' : 'payment.failed', reference, { environment, status }, session, key);
      return { status, key };
    });
    if (!automationConfigured(config)) void deliverNotice(result.key, sendEmail);
    return result.status;
  }

  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/status', limits, async (request, response) => {
    const order = await accessibleOrder(request, parseInput(access, request.body));
    response.json({ reference: order.reference, status: order.paymentStatus, environment: order.paymentEnvironment, amount: order.totals.total });
  });

  router.post('/payhere/start', limits, async (request, response) => {
    const order = await accessibleOrder(request, parseInput(access, request.body));
    if (order.paymentMethod !== 'payhere' || !mode || mode !== order.paymentEnvironment || order.orderStatus === 'cancelled' ||
        !['pending', 'failed'].includes(order.paymentStatus)) {
      throw new HttpError(409, 'PAYMENT_UNAVAILABLE', 'This online payment cannot be started.');
    }
    if (mode === 'simulator') {
      response.json({ environment: mode });
      return;
    }

    const merchant = config.payhereMerchant;
    const notify = config.payhereNotifyUrl;
    const secret = config.payhereSecret;
    if (!merchant || !notify || !secret || !order.billing) throw new HttpError(503, 'PAYMENT_UNAVAILABLE', 'PayHere is unavailable.');
    const amount = order.totals.total.toFixed(2);
    const [first, ...last] = order.customer.name.trim().split(/\s+/);
    const returned = new URL('/payment-result', config.siteOrigin);
    returned.searchParams.set('reference', order.reference);
    const cancelled = new URL(returned);
    cancelled.searchParams.set('cancelled', '1');
    response.json({
      environment: mode,
      action: mode === 'live' ? 'https://www.payhere.lk/pay/checkout' : 'https://sandbox.payhere.lk/pay/checkout',
      fields: {
        merchant_id: merchant, return_url: returned.href, cancel_url: cancelled.href, notify_url: notify,
        first_name: first, last_name: last.join(' ') || first, email: order.customer.email,
        phone: order.customer.phone.replace(/[^+\d]/g, ''),
        address: order.billing.address, city: order.billing.city, country: 'Sri Lanka',
        order_id: order.reference, items: order.reference, currency: 'LKR', amount,
        hash: checkoutHash(merchant, order.reference, amount, 'LKR', secret),
      },
    });
  });

  router.post('/simulate', limits, async (request, response) => {
    if (mode !== 'simulator') throw new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.');
    const data = parseInput(simulation, request.body);
    const order = await accessibleOrder(request, data);
    if (order.orderStatus === 'cancelled') throw new HttpError(409, 'PAYMENT_UNAVAILABLE', 'The order is cancelled.');
    const status = await changePayment(order.reference, mode, order.totals.total, data.outcome, `sim-${order.reference}`, data.outcome);
    response.json({ reference: order.reference, status, environment: mode, amount: order.totals.total });
  });

  router.post('/payhere/notify', express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 40 }), async (request, response) => {
    const { payhereMerchant, payhereSecret } = config;
    if (!mode || mode === 'simulator' || !payhereMerchant || !payhereSecret) throw new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.');
    if (!request.is('application/x-www-form-urlencoded')) throw new HttpError(415, 'INVALID_CONTENT_TYPE', 'Send the payment notification as a form.');
    const notice = parseInput(callbackInput, request.body);
    if (!verifyCallback(notice, payhereMerchant, payhereSecret)) throw new HttpError(403, 'INVALID_PAYMENT_SIGNATURE', 'The payment notification could not be verified.');
    const next: Record<string, PaymentState> = { '2': 'paid', '0': 'pending', '-1': 'failed', '-2': 'failed', '-3': 'refunded' };
    await changePayment(notice.order_id, mode, Number(notice.payhere_amount), next[notice.status_code], notice.payment_id, notice.status_code);
    response.status(200).end();
  });

  return router;
}
