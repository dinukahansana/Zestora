import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config.ts';
import { databaseReady } from '../database.ts';
import { eventJson, eventSignature, Outbox, type EventType } from './events.ts';

const attemptsAllowed = 6;
const leaseTime = 30000;
const workflow: Partial<Record<EventType, string>> = {
  'order.created': 'zestora-order-created',
  'order.status_changed': 'zestora-order-status',
  'order.feedback_requested': 'zestora-customer-feedback',
  'review.created': 'zestora-feedback-analysis',
  'inventory.low_stock': 'zestora-low-stock',
};

export function automationConfigured(config: AppConfig) {
  return !!(config.n8nBaseUrl && config.n8nSecret);
}

export async function deliverOne(config: AppConfig, now = new Date()) {
  const { n8nBaseUrl, n8nSecret } = config;
  if (!n8nBaseUrl || !n8nSecret || !databaseReady()) return false;
  await Outbox.updateMany({ state: 'sending', leaseUntil: { $lte: now }, attempts: { $gte: attemptsAllowed } }, {
    $set: { state: 'failed', lastError: 'Lease expired after final attempt' }, $unset: { leaseKey: 1, leaseUntil: 1 },
  });

  const leaseKey = randomUUID();
  const item = await Outbox.findOneAndUpdate({
    attempts: { $lt: attemptsAllowed },
    $or: [
      { state: { $in: ['queued', 'retry'] }, nextAttempt: { $lte: now } },
      { state: 'sending', leaseUntil: { $lte: now } },
    ],
  }, {
    $inc: { attempts: 1 }, $set: { state: 'sending', leaseKey, leaseUntil: new Date(now.getTime() + leaseTime) },
  }, { returnDocument: 'after', sort: { nextAttempt: 1, _id: 1 } }).lean();
  if (!item) return false;

  const endpoint = new URL(workflow[item.event.eventType] ?? 'zestora-events', n8nBaseUrl.endsWith('/') ? n8nBaseUrl : n8nBaseUrl + '/');
  const timestamp = String(Math.floor(Date.now() / 1000));
  let issue = '';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zestora-Timestamp': timestamp,
        'X-Zestora-Signature': eventSignature(item.event, timestamp, n8nSecret),
      },
      body: eventJson(item.event), redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    await response.body?.cancel();
    if (!response.ok) issue = `Workflow returned HTTP ${response.status}`;
    else if (!(await Outbox.exists({ _id: item._id, processedAt: { $exists: true } }))) issue = 'Workflow did not acknowledge the event';
  } catch {
    issue = 'Workflow request failed or timed out';
  }

  const retryMs = Math.min(60 * 60 * 1000, 15000 * 2 ** (item.attempts - 1));
  const change = issue
    ? { state: item.attempts >= attemptsAllowed ? 'failed' : 'retry', lastError: issue, nextAttempt: new Date(Date.now() + retryMs) }
    : { state: 'delivered', deliveredAt: new Date(), lastError: '' };
  await Outbox.updateOne({ _id: item._id, leaseKey }, { $set: change, $unset: { leaseKey: 1, leaseUntil: 1 } });
  return true;
}

export function startDelivery(config: AppConfig) {
  if (!automationConfigured(config)) return () => {};
  let busy = false;
  let stopped = false;
  async function tick() {
    if (busy || stopped) return;
    busy = true;
    try {
      for (let count = 0; count < 8 && !stopped; count += 1) {
        if (!(await deliverOne(config))) break;
      }
    } catch {
      console.error('Outbox delivery cycle failed.');
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(() => void tick(), 4000);
  timer.unref();
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
