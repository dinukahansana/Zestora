import { z } from 'zod';
import { accountEmail, accountName } from '../auth/routes.ts';
import { slugSchema } from '../catalogue/schemas.ts';

const comment = z.string().trim().max(500).default('');
const mobile = z.string().trim().min(7).max(25).regex(/^\+?[\d ()-]+$/);
export const orderReference = z.string().trim().toUpperCase().regex(/^Z-[A-F0-9]{20}$/);
export const guestKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/);
export const selection = z.strictObject({
  productSlug: slugSchema,
  sizeId: slugSchema,
  addOnIds: z.array(slugSchema).max(30).refine(values => new Set(values).size === values.length),
  quantity: z.number().int().min(1).max(10),
});

const cartFields = {
  items: z.array(selection).min(1).max(40),
  coupon: codeSchema.optional(),
};
export const quoteInput = z.strictObject({
  ...cartFields,
  fulfillment: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('pickup') }),
    z.strictObject({ type: z.literal('delivery'), zoneId: slugSchema }),
  ]),
});

const requestedTime = z.iso.datetime().optional();
export const checkoutInput = z.strictObject({
  ...cartFields,
  fulfillment: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('pickup'), preferredAt: requestedTime }),
    z.strictObject({ type: z.literal('delivery'), zoneId: slugSchema, address: z.string().trim().min(8).max(350), instructions: comment, preferredAt: requestedTime }),
  ]),
  customer: z.strictObject({ name: accountName, email: accountEmail, phone: mobile }),
  notes: comment,
  payment: z.enum(['cash', 'payhere']).default('cash'),
  billing: z.strictObject({ address: z.string().trim().min(8).max(350), city: z.string().trim().min(2).max(100) }).optional(),
  language: z.enum(['en', 'si']).default('en'),
  expectedTotal: z.number().int().nonnegative().max(1000000000),
  checkoutKey: z.uuid(),
  guestKey: guestKeySchema.optional(),
});

export const trackingInput = z.strictObject({ reference: orderReference, key: guestKeySchema });

export type QuoteInput = z.infer<typeof quoteInput>;
export type CheckoutInput = z.infer<typeof checkoutInput>;
export type LocalText = { en: string; si: string };
