import type { ClientSession } from 'mongoose';
import { Stock, StockMovement } from '../admin/models.ts';
import { recordEvent } from '../automation/events.ts';
import { HttpError } from '../http.ts';

export interface StockUse { stockSlug: string; units: number }

export async function consumeStock(reference: string, usage: StockUse[], session: ClientSession) {
  if (!usage.length) return;
  for (const { stockSlug, units } of usage) {
    const previous = await Stock.findOneAndUpdate({ slug: stockSlug, onHand: { $gte: units } }, { $inc: { onHand: -units } }, { session }).lean();
    if (!previous) throw new HttpError(409, 'ITEM_UNAVAILABLE', 'An ingredient is no longer in stock.');
    const updated = previous.onHand - units;
    if (previous.onHand > previous.threshold && updated <= previous.threshold) {
      await recordEvent('inventory.low_stock', stockSlug, { onHand: updated, threshold: previous.threshold }, session);
    }
  }
  await new StockMovement({ orderReference: reference, usage }).save({ session });
}

export async function restoreStock(reference: string, session: ClientSession) {
  const movement = await StockMovement.findOneAndUpdate({ orderReference: reference, releasedAt: { $exists: false } }, { $set: { releasedAt: new Date() } }, { session });
  for (const part of movement?.usage ?? []) await Stock.updateOne({ slug: part.stockSlug }, { $inc: { onHand: part.units } }, { session });
}
