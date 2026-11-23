import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { model, Schema, type ClientSession } from 'mongoose';
import { z } from 'zod';

export const eventTypes = [
  'order.created', 'order.status_changed', 'payment.completed', 'payment.failed',
  'product.created', 'product.updated', 'inventory.low_stock', 'review.created', 'customer.registered',
] as const;
export type EventType = typeof eventTypes[number];

export const envelopeSchema = z.strictObject({
  eventId: z.uuid(),
  eventType: z.enum(eventTypes),
  schemaVersion: z.literal(1),
  occurredAt: z.iso.datetime(),
  businessId: z.literal('default'),
  resourceId: z.string().min(1).max(100),
  payload: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,39}$/), z.union([z.string().max(160), z.number(), z.boolean()])),
});
export type Envelope = z.infer<typeof envelopeSchema>;
export type EventState = 'queued' | 'sending' | 'retry' | 'failed' | 'delivered';

interface EventRecord {
  event: Envelope;
  state: EventState;
  attempts: number;
  nextAttempt: Date;
  leaseUntil?: Date;
  leaseKey?: string;
  deliveredAt?: Date;
  processedAt?: Date;
  lastError?: string;
  noticeKey?: string;
  createdAt?: Date;
}

const outboxSchema = new Schema<EventRecord>({
  event: { type: Schema.Types.Mixed, required: true },
  state: { type: String, enum: ['queued', 'sending', 'retry', 'failed', 'delivered'], default: 'queued' },
  attempts: { type: Number, default: 0 },
  nextAttempt: { type: Date, default: Date.now },
  leaseUntil: Date,
  leaseKey: String,
  deliveredAt: Date,
  processedAt: Date,
  lastError: String,
  noticeKey: String,
}, { timestamps: true, minimize: false });
outboxSchema.index({ 'event.eventId': 1 }, { unique: true });
outboxSchema.index({ state: 1, nextAttempt: 1, leaseUntil: 1 });
export const Outbox = model('Outbox', outboxSchema);

export async function recordEvent(
  type: EventType, resourceId: string, payload: Envelope['payload'], session: ClientSession, noticeKey?: string,
) {
  const event = envelopeSchema.parse({
    eventId: randomUUID(), eventType: type, schemaVersion: 1, occurredAt: new Date().toISOString(),
    businessId: 'default', resourceId, payload,
  });
  await new Outbox({ event, noticeKey }).save({ session });
}

export function eventJson(event: Envelope) {
  const data = event.payload ?? {};
  const payload = Object.fromEntries(Object.keys(data).sort().map(key => [key, data[key]]));
  return JSON.stringify({
    eventId: event.eventId, eventType: event.eventType, schemaVersion: event.schemaVersion,
    occurredAt: event.occurredAt, businessId: event.businessId, resourceId: event.resourceId, payload,
  });
}

export function eventSignature(event: Envelope, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${eventJson(event)}`).digest('hex');
}

export function verifiedSignature(event: Envelope, timestamp: string, signature: string, secret: string) {
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(eventSignature(event, timestamp, secret), 'hex'));
}
