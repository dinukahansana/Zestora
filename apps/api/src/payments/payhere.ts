import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from '../config.ts';
import { orderReference } from '../ordering/schemas.ts';

const checksum = (value: string) => createHash('md5').update(value).digest('hex').toUpperCase();

export function checkoutHash(merchant: string, reference: string, amount: string, currency: string, secret: string) {
  return checksum(merchant + reference + amount + currency + checksum(secret));
}

export const callbackInput = z.object({
  merchant_id: z.string().regex(/^[0-9]{4,15}$/),
  order_id: orderReference,
  payment_id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  payhere_amount: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
  payhere_currency: z.literal('LKR'),
  status_code: z.enum(['2', '0', '-1', '-2', '-3']),
  md5sig: z.string().regex(/^[A-Fa-f0-9]{32}$/),
});

export type PayHereCallback = z.infer<typeof callbackInput>;

export function verifyCallback(body: PayHereCallback, merchant: string, secret: string) {
  if (body.merchant_id !== merchant) return false;
  const expected = checksum(body.merchant_id + body.order_id + body.payhere_amount + body.payhere_currency + body.status_code + checksum(secret));
  return timingSafeEqual(Buffer.from(body.md5sig, 'hex'), Buffer.from(expected, 'hex'));
}

export function paymentMode(config: AppConfig) {
  if (config.payhereMerchant && config.payhereSecret && config.payhereNotifyUrl &&
      (config.payhereMode === 'sandbox' || (config.payhereLiveEnabled && config.secureCookies && new URL(config.siteOrigin).protocol === 'https:'))) return config.payhereMode;
  return config.payhereSimulator && !config.secureCookies ? 'simulator' : undefined;
}
