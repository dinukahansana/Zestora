import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AuditLog, Stock, StockMovement } from '../admin/models.ts';
import { automationConfigured } from '../automation/delivery.ts';
import { recordEvent } from '../automation/events.ts';
import { sessionAccess } from '../auth/routes.ts';
import { slugSchema } from '../catalogue/schemas.ts';
import type { AppConfig } from '../config.ts';
import { HttpError, isDuplicateKey, parseInput } from '../http.ts';
import { Order } from '../ordering/models.ts';
import { orderReference } from '../ordering/schemas.ts';
import { analyzeReview, createDraft, createReport, draftInput, feedbackSummary, reportInput, reviewInput } from './business.ts';
import { assistant, assistantInput, recommendations, recommendationInput } from './catalogue.ts';
import { AiUsage, BusinessReport, MarketingDraft, Review } from './models.ts';
import type { AiProvider } from './provider.ts';
import type { AiRunner } from './runner.ts';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

export function aiRoutes(config: AppConfig, runner: AiRunner, provider: AiProvider) {
  const router = Router();
  const sessions = sessionAccess(config);
  const limit = rateLimit({
    windowMs: 5 * 60000, limit: 25, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'TOO_MANY_REQUESTS', 'Try again later.')),
  });

  router.post('/ai/assistant', limit, async (request, response) => {
    const input = parseInput(assistantInput, request.body);
    const user = await sessions.current(request);
    response.set('Cache-Control', 'no-store').json(await assistant(input, runner, user?._id));
  });

  router.post('/ai/recommendations', limit, async (request, response) => {
    const input = parseInput(recommendationInput, request.body);
    const user = await sessions.current(request);
    response.set('Cache-Control', 'no-store').json(await recommendations(input, runner, user?._id));
  });

  router.post('/reviews', limit, async (request, response) => {
    const user = await sessions.requireUser(request);
    const input = parseInput(reviewInput.extend({ reference: orderReference, productSlug: slugSchema }), request.body);
    const order = await Order.findOne({ reference: input.reference, userId: user._id, orderStatus: 'completed', 'items.productSlug': input.productSlug }).select('_id').lean();
    if (!order) throw new HttpError(403, 'REVIEW_UNAVAILABLE', 'Only completed order items can be reviewed.');
    try {
      const review = await mongoose.connection.transaction(async session => {
        const item = await new Review({
          customerId: user._id, orderReference: input.reference, productSlug: input.productSlug,
          rating: input.rating, text: input.text, language: input.language,
        }).save({ session });
        await recordEvent('review.created', item._id.toString(), { productSlug: input.productSlug }, session);
        return item;
      });
      if (!automationConfigured(config)) void analyzeReview(review._id.toString(), provider).catch(() => console.error('Feedback analysis failed.'));
      response.status(201).json({ id: review._id });
    } catch (error) {
      if (isDuplicateKey(error)) throw new HttpError(409, 'REVIEW_EXISTS', 'An item can be reviewed once per order.');
      throw error;
    }
  });

  const admin = Router();
  admin.use(async (request, response, next) => {
    const actor = await sessions.requireUser(request, 'admin');
    response.locals.actorId = actor._id;
    response.set('Cache-Control', 'no-store');
    next();
  });
  admin.get('/reports', async (_request, response) => response.json({ items: await BusinessReport.find().sort({ createdAt: -1 }).limit(20).lean() }));
  admin.post('/reports', limit, async (request, response) => {
    const { period, language } = parseInput(reportInput, request.body);
    response.status(201).json({ report: await createReport(period, language, runner) });
  });
  admin.get('/feedback', async (_request, response) => response.json(await feedbackSummary()));
  admin.get('/drafts', async (_request, response) => response.json({ items: await MarketingDraft.find().sort({ createdAt: -1 }).limit(30).lean() }));
  admin.post('/drafts', limit, async (request, response) => response.status(201).json({ draft: await createDraft(parseInput(draftInput, request.body), runner) }));
  admin.patch('/drafts/:id/approve', async (request, response) => {
    const id = parseInput(objectId, request.params.id);
    const draft = await mongoose.connection.transaction(async session => {
      const item = await MarketingDraft.findOneAndUpdate({ _id: id, status: 'draft' }, {
        $set: { status: 'approved', approvedAt: new Date() },
      }, { session, returnDocument: 'after' });
      if (!item) throw new HttpError(404, 'DRAFT_UNAVAILABLE', 'This draft is no longer available for approval.');
      await new AuditLog({ actorId: response.locals.actorId, action: 'approved', entity: 'marketing_draft', reference: id }).save({ session });
      return item;
    });
    response.json({ draft });
  });
  admin.get('/inventory', async (_request, response) => {
    const since = new Date(Date.now() - 30 * 86400000);
    const [items, usage] = await Promise.all([
      Stock.find().select('slug name unit onHand threshold').sort({ slug: 1 }).lean(),
      StockMovement.aggregate<{ _id: string; used: number }>([
        { $match: { releasedAt: { $exists: false }, createdAt: { $gte: since } } },
        { $unwind: '$usage' }, { $group: { _id: '$usage.stockSlug', used: { $sum: '$usage.units' } } },
      ]),
    ]);
    const counts = new Map(usage.map(item => [item._id, item.used]));
    response.json({ items: items.map(item => ({ ...item, used: counts.get(item.slug) ?? 0 })) });
  });
  admin.get('/usage', async (_request, response) => {
    const since = new Date(Date.now() - 30 * 86400000);
    const items = await AiUsage.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
        _id: '$feature', requests: { $sum: 1 }, success: { $sum: { $cond: ['$ok', 1, 0] } },
        inputTokens: { $sum: '$inputTokens' }, outputTokens: { $sum: '$outputTokens' },
      } }, { $sort: { _id: 1 } },
    ]);
    response.json({ enabled: provider.enabled, items });
  });
  return { router, admin };
}
