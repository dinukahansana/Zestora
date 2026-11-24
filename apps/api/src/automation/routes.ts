import { Router } from 'express';
import { analyzeReview } from '../ai/business.ts';
import type { AiProvider } from '../ai/provider.ts';
import { rateLimit } from 'express-rate-limit';
import type { AppConfig } from '../config.ts';
import { HttpError, parseInput } from '../http.ts';
import type { SendEmail } from '../mail.ts';
import { deliverNotice, deliverStockNotice } from '../notifications.ts';
import { envelopeSchema, eventJson, Outbox, verifiedSignature } from './events.ts';

export function automationRouter(config: AppConfig, sendEmail: SendEmail | undefined, provider: AiProvider) {
  const router = Router();
  const limit = rateLimit({ windowMs: 60000, limit: 250, standardHeaders: 'draft-8', legacyHeaders: false });

  router.post('/consume', limit, async (request, response) => {
    if (!config.n8nSecret) throw new HttpError(404, 'NOT_FOUND', 'This integration is unavailable.');
    const event = parseInput(envelopeSchema, request.body);
    const timestamp = request.get('x-zestora-timestamp') ?? '';
    const signature = request.get('x-zestora-signature') ?? '';
    if (!verifiedSignature(event, timestamp, signature, config.n8nSecret)) throw new HttpError(403, 'INVALID_EVENT_SIGNATURE', 'This event could not be verified.');
    const item = await Outbox.findOne({ 'event.eventId': event.eventId }).lean();
    if (!item || eventJson(item.event) !== eventJson(event)) throw new HttpError(404, 'EVENT_NOT_FOUND', 'The event was not found.');
    if (!item.processedAt) {
      if (event.eventType === 'review.created') await analyzeReview(event.resourceId, provider);
      if (event.eventType === 'inventory.low_stock') await deliverStockNotice(event.eventId, event.resourceId, sendEmail);
      await deliverNotice(item.noticeKey, sendEmail);
      await Outbox.updateOne({ _id: item._id, processedAt: { $exists: false } }, { $set: { processedAt: new Date() } });
    }
    response.set('Cache-Control', 'no-store').json({ accepted: true, eventId: event.eventId, duplicate: !!item.processedAt });
  });

  return router;
}
